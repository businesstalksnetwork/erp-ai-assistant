import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { signature_id, action, app_url } = await req.json();

    if (!signature_id || !action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    // Fetch signature with document info
    const { data: sig, error: sigError } = await supabase
      .from("document_signatures")
      .select("*, documents(name, protocol_number)")
      .eq("id", signature_id)
      .single();

    if (sigError || !sig) {
      return new Response(JSON.stringify({ error: "Signature not found" }), {
        status: 404, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    // Fetch tenant settings for email
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, settings")
      .eq("id", sig.tenant_id)
      .single();

    const tenantName = tenant?.name || "ProERP";
    const baseUrl = app_url || "https://proerpai.lovable.app";
    const signUrl = `${baseUrl}/sign-document/${sig.token}`;
    const docTitle = sig.documents?.name || "Dokument";

    let subject = "";
    let body = "";

    if (action === "request") {
      subject = `Zahtev za potpis: ${docTitle}`;
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Zahtev za potpis dokumenta</h2>
          <p>Poštovani${sig.signer_name ? ` ${sig.signer_name}` : ""},</p>
          <p>Organizacija <strong>${tenantName}</strong> vam šalje dokument na potpis:</p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <strong>${docTitle}</strong>
            ${sig.documents?.protocol_number ? `<br/>Broj: ${sig.documents.protocol_number}` : ""}
          </div>
          <p>Kliknite na dugme ispod da pregledate i potpišete dokument:</p>
          <a href="${signUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Potpiši dokument</a>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">Link važi 7 dana. Ako imate pitanja, kontaktirajte pošiljaoca.</p>
        </div>
      `;
    } else if (action === "signed") {
      // Notify the requester
      subject = `Dokument potpisan: ${docTitle}`;
      body = `<p>${sig.signer_name || sig.signer_email} je potpisao/la dokument "${docTitle}".</p>`;
    } else if (action === "rejected") {
      subject = `Dokument odbijen: ${docTitle}`;
      body = `<p>${sig.signer_name || sig.signer_email} je odbio/la potpis dokumenta "${docTitle}".</p>
              ${sig.rejection_reason ? `<p>Razlog: ${sig.rejection_reason}</p>` : ""}`;
    }

    // Log the notification (actual email sending would use Resend or similar)
    console.log(`[send-document-signature] Action: ${action}, To: ${sig.signer_email}, Subject: ${subject}`);

    // Try sending via Resend if configured
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && action === "request") {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${tenantName} <noreply@${Deno.env.get("RESEND_DOMAIN") || "resend.dev"}>`,
            to: [sig.signer_email],
            subject,
            html: body,
          }),
        });
        const emailResult = await emailRes.json();
        console.log("Email sent:", emailResult);
      } catch (emailErr) {
        console.error("Email send failed (non-critical):", emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true, sign_url: signUrl }), {
      headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    });
  } catch (error) {
    return createErrorResponse(error, req, { logPrefix: "send-document-signature" });
  }
});
