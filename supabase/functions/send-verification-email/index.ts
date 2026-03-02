import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const PRODUCTION_URL = "https://erp-ai-assistant.aiknjigovodja.rs";

// Lista blokiranih disposable email domena - backup server-side provera
const BLOCKED_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 
  '10minutemail.com', 'throwaway.email', 'fakeinbox.com',
  'maildrop.cc', 'yopmail.com', 'temp-mail.org',
  'disposablemail.com', 'trashmail.com', 'getnada.com',
  'mohmal.com', 'tempail.com', 'emailondeck.com', 'sharklasers.com',
  'guerrillamail.info', 'grr.la', 'guerrillamail.biz', 'guerrillamail.de',
  'guerrillamail.net', 'guerrillamail.org', 'spam4.me', 'getairmail.com',
  'mailnesia.com', 'tmpmail.org', 'tmpmail.net', 'discard.email',
  'mailcatch.com', 'mintemail.com', 'mt2009.com', 'nospam.ze.tc',
  'owlymail.com', 'rmqkr.net', 'jetable.org', 'spamgourmet.com'
];

const isDisposableEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? BLOCKED_EMAIL_DOMAINS.includes(domain) : false;
};

interface VerificationEmailRequest {
  user_id: string;
  email: string;
  full_name: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, email, full_name }: VerificationEmailRequest = await req.json();

    console.log(`[send-verification-email] Processing request for email: ${email}`);

    if (!user_id || !email) {
      throw new Error("Missing required fields: user_id and email");
    }

    // Server-side backup: Block disposable email domains
    if (isDisposableEmail(email)) {
      console.log(`[send-verification-email] Blocked disposable email: ${email}`);
      throw new Error("Disposable email addresses are not allowed");
    }

    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generate secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    console.log(`[send-verification-email] Generated token for user: ${user_id}`);

    // Delete any existing tokens for this user (cleanup)
    await supabaseAdmin
      .from("verification_tokens")
      .delete()
      .eq("user_id", user_id);

    // Save token to database
    const { error: insertError } = await supabaseAdmin
      .from("verification_tokens")
      .insert({
        user_id,
        email,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("[send-verification-email] Error saving token:", insertError);
      throw new Error("Failed to save verification token");
    }

    console.log(`[send-verification-email] Token saved to database`);

    // Fetch email template
    const { data: template, error: templateError } = await supabaseAdmin
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "email_verification")
      .single();

    if (templateError || !template) {
      console.error("[send-verification-email] Template not found:", templateError);
      throw new Error("Email template not found");
    }

    // Build verification URL
    const verificationUrl = `${PRODUCTION_URL}/verify?token=${token}`;

    // Replace placeholders in template
    const htmlContent = template.html_content
      .replace(/\{\{full_name\}\}/g, full_name || "korisniče")
      .replace(/\{\{verification_url\}\}/g, verificationUrl);

    console.log(`[send-verification-email] Sending email via Resend to: ${email}`);

    // Send email via Resend
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "ERP-AI Assistant <verification@erp-ai-assistant.rs>",
      to: [email],
      subject: template.subject,
      html: htmlContent,
    });

    if (emailError) {
      console.error("[send-verification-email] Resend error:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log(`[send-verification-email] Email sent successfully:`, emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification email sent successfully" 
      }),
      {
        status: 200,
        headers: withSecurityHeaders({ "Content-Type": "application/json", ...corsHeaders }),
      }
    );
  } catch (error: any) {
    console.error("[send-verification-email] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: withSecurityHeaders({ "Content-Type": "application/json", ...corsHeaders }),
      }
    );
  }
});
