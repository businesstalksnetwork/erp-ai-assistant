import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function renderTemplate(template: string, data: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value?.toString() || '');
  }
  return result;
}

interface Recipient {
  email: string;
  full_name: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipients, templateKey } = await req.json() as {
      recipients: Recipient[];
      templateKey: string;
    };

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notificationType = "admin_bulk_" + templateKey;

    // Deduplication: check who already received this email or automated trial_expiring_1d
    const { data: alreadySent } = await supabase
      .from("email_notification_log")
      .select("email_to")
      .or(`notification_type.eq.${notificationType},notification_type.eq.trial_expiring_1d`);

    const sentSet = new Set((alreadySent || []).map((r: any) => r.email_to));
    const toSend = recipients.filter(r => !sentSet.has(r.email));
    const skipped = recipients.length - toSend.length;

    console.log(`Bulk email: ${recipients.length} total, ${skipped} skipped, ${toSend.length} to send, template: ${templateKey}`);

    // Load template from database
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", templateKey)
      .single();

    // Default fallback
    const defaultSubject = "Vaš probni period na PausalBox-u je istekao";
    const defaultHtml = `<p>Zdravo {{full_name}},</p><p>Vaš besplatni probni period na PausalBox-u je istekao. Aktivirajte pretplatu da biste nastavili sa korišćenjem.</p><p>Posetite <a href="https://pausalbox.lovable.app">PausalBox</a> za više informacija.</p>`;

    let sent = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const recipient of toSend) {
      try {
        const data = {
          full_name: recipient.full_name || recipient.email,
        };

        const subject = template
          ? renderTemplate(template.subject, data)
          : defaultSubject;
        const html = template
          ? renderTemplate(template.html_content, data)
          : renderTemplate(defaultHtml, data);

        const emailRes = await resend.emails.send({
          from: "PausalBox <obavestenja@pausalbox.rs>",
          to: [recipient.email],
          subject,
          html,
        });

        if (emailRes.error) {
          // If rate limited, retry once after 1.5s
          if ((emailRes.error as any).statusCode === 429) {
            console.log(`Rate limited for ${recipient.email}, retrying after 1.5s...`);
            await sleep(1500);
            const retryRes = await resend.emails.send({
              from: "PausalBox <obavestenja@pausalbox.rs>",
              to: [recipient.email],
              subject,
              html,
            });
            if (retryRes.error) {
              console.error(`Retry failed for ${recipient.email}:`, retryRes.error);
              errors++;
              errorDetails.push(`${recipient.email}: ${retryRes.error.message}`);
              await sleep(600);
              continue;
            }
          } else {
            console.error(`Failed to send to ${recipient.email}:`, emailRes.error);
            errors++;
            errorDetails.push(`${recipient.email}: ${emailRes.error.message}`);
            await sleep(600);
            continue;
          }
        }

        // Log the notification
        await supabase.from("email_notification_log").insert({
          company_id: null,
          user_id: callingUser.id,
          notification_type: notificationType,
          email_to: recipient.email,
          subject,
        });

        sent++;
        console.log(`Sent to ${recipient.email}`);
        await sleep(600);
      } catch (err) {
        console.error(`Error sending to ${recipient.email}:`, err);
        errors++;
        errorDetails.push(`${recipient.email}: ${err.message}`);
      }
    }

    console.log(`Bulk email complete: ${sent} sent, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, sent, errors, skipped, errorDetails }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-admin-bulk-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
