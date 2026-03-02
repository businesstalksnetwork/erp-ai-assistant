import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface NotificationRequest {
  revers_id: string;
  tenant_id: string;
  action: "request_signature" | "reminder" | "signed" | "rejected";
  app_url?: string;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SEC-1: Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { revers_id, tenant_id, action, app_url } = await req.json() as NotificationRequest;

    if (!revers_id || !tenant_id || !action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEC-1: Verify caller is active member of tenant (or super_admin)
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("id, role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      // Check super_admin
      const { data: superRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();
      if (!superRole) {
        return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // SEC-2: Fetch revers with tenant_id filter
    const { data: revers, error: reversError } = await supabase
      .from("asset_reverses")
      .select("*, assets(name, asset_code, inventory_number), employees(first_name, last_name, email, employee_id)")
      .eq("id", revers_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (reversError || !revers) {
      return new Response(JSON.stringify({ error: "Revers not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenant_id)
      .single();

    const tenantName = tenant?.name || "Company";
    const employeeName = revers.employees ? `${revers.employees.first_name} ${revers.employees.last_name}` : "Employee";
    const employeeEmail = revers.employees?.email;
    const assetName = revers.assets?.name || "Asset";
    const assetCode = revers.assets?.asset_code || "";
    const baseUrl = app_url || "https://proerpai.lovable.app";
    const signUrl = `${baseUrl}/sign/${revers.signature_token}`;

    // Fetch issuer email
    let issuerEmail: string | null = null;
    if (revers.issued_by) {
      const { data: issuerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", revers.issued_by)
        .single();
      issuerEmail = issuerProfile?.email || null;
    }

    let emailSubject = "";
    let emailHtml = "";
    let recipientEmail = "";
    let updateData: Record<string, unknown> = {};

    const reversTypeLabel = revers.revers_type === "handover" ? "Predaja sredstva" : "Povraćaj sredstva";

    if (action === "request_signature") {
      recipientEmail = employeeEmail || "";
      emailSubject = `${tenantName} — Potpis reversa ${revers.revers_number}`;

      // Generate new token + expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: updatedRevers } = await supabase
        .from("asset_reverses")
        .update({
          status: "pending_signature",
          signature_token_expires_at: expiresAt.toISOString(),
          notification_sent_at: new Date().toISOString(),
        })
        .eq("id", revers_id)
        .select("signature_token")
        .single();

      const tokenUrl = `${baseUrl}/sign/${updatedRevers?.signature_token || revers.signature_token}`;

      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Zahtev za potpis reversa</h2>
          <p>Poštovani/a ${employeeName},</p>
          <p>Kompanija <strong>${tenantName}</strong> vam šalje revers na potpis:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Broj reversa</td><td style="padding: 8px; border: 1px solid #ddd;">${revers.revers_number}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tip</td><td style="padding: 8px; border: 1px solid #ddd;">${reversTypeLabel}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Sredstvo</td><td style="padding: 8px; border: 1px solid #ddd;">${assetCode} — ${assetName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Datum</td><td style="padding: 8px; border: 1px solid #ddd;">${revers.revers_date}</td></tr>
            ${revers.condition_on_handover ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Stanje</td><td style="padding: 8px; border: 1px solid #ddd;">${revers.condition_on_handover}</td></tr>` : ""}
            ${revers.accessories ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pribor</td><td style="padding: 8px; border: 1px solid #ddd;">${revers.accessories}</td></tr>` : ""}
          </table>
          <p>Kliknite na dugme ispod da potpišete ili odbijete revers:</p>
          <a href="${tokenUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Potpiši revers</a>
          <p style="margin-top: 16px; color: #666; font-size: 13px;">Ovaj link važi 7 dana. Ako imate pitanja, kontaktirajte vašu administraciju.</p>
        </div>
      `;
      updateData = {};
    } else if (action === "reminder") {
      recipientEmail = employeeEmail || "";
      emailSubject = `PODSETNIK: ${tenantName} — Potpis reversa ${revers.revers_number}`;
      const tokenUrl = `${baseUrl}/sign/${revers.signature_token}`;

      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Podsetnik — Potpis reversa</h2>
          <p>Poštovani/a ${employeeName},</p>
          <p>Podsećamo vas da revers <strong>${revers.revers_number}</strong> za sredstvo <strong>${assetCode} — ${assetName}</strong> još uvek čeka vaš potpis.</p>
          <a href="${tokenUrl}" style="display: inline-block; padding: 12px 24px; background-color: #d97706; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Potpiši revers</a>
          <p style="margin-top: 16px; color: #666; font-size: 13px;">Ovaj link važi do isteka prvobitnog roka.</p>
        </div>
      `;
      updateData = { reminder_sent_at: new Date().toISOString() };
    } else if (action === "signed") {
      recipientEmail = issuerEmail || "";
      emailSubject = `✅ Revers ${revers.revers_number} potpisan — ${employeeName}`;

      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Revers potpisan</h2>
          <p>Zaposleni/a <strong>${employeeName}</strong> je potpisao/la revers <strong>${revers.revers_number}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Sredstvo</td><td style="padding: 8px; border: 1px solid #ddd;">${assetCode} — ${assetName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Potpisan</td><td style="padding: 8px; border: 1px solid #ddd;">${revers.employee_signed_at || new Date().toISOString()}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Ime potpisnika</td><td style="padding: 8px; border: 1px solid #ddd;">${revers.employee_signed_by_name || employeeName}</td></tr>
          </table>
        </div>
      `;
      updateData = {};
    } else if (action === "rejected") {
      recipientEmail = issuerEmail || "";
      emailSubject = `❌ Revers ${revers.revers_number} odbijen — ${employeeName}`;

      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Revers odbijen</h2>
          <p>Zaposleni/a <strong>${employeeName}</strong> je odbio/la revers <strong>${revers.revers_number}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Sredstvo</td><td style="padding: 8px; border: 1px solid #ddd;">${assetCode} — ${assetName}</td></tr>
            ${revers.rejection_reason ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Razlog</td><td style="padding: 8px; border: 1px solid #ddd;">${revers.rejection_reason}</td></tr>` : ""}
          </table>
        </div>
      `;
      updateData = {};
    }

    // Update revers tracking fields
    if (Object.keys(updateData).length > 0) {
      await supabase.from("asset_reverses").update(updateData).eq("id", revers_id);
    }

    // Send email if Resend is configured and recipient exists
    let emailSent = false;
    if (resendApiKey && recipientEmail) {
      try {
        const resend = new (await import("https://esm.sh/resend@2.0.0")).Resend(resendApiKey);
        const { error: emailError } = await resend.emails.send({
          from: `${tenantName} <noreply@${Deno.env.get("RESEND_DOMAIN") || "resend.dev"}>`,
          to: recipientEmail,
          subject: emailSubject,
          html: emailHtml,
        });
        if (emailError) {
          console.error("Resend error:", emailError);
        } else {
          emailSent = true;
        }
      } catch (e) {
        console.error("Failed to send email:", e);
      }
    } else {
      console.log("Email not sent — RESEND_API_KEY not configured or no recipient email.", {
        hasApiKey: !!resendApiKey,
        recipientEmail,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      emailSent,
      recipientEmail: recipientEmail || null,
      action,
      message: emailSent
        ? `Email sent to ${recipientEmail}`
        : resendApiKey
          ? "No recipient email found"
          : "RESEND_API_KEY not configured — revers status updated without email",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-revers-notification error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
