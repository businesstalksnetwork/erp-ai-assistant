import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

/**
 * SEF Webhook handler — receives push notifications from Serbian eFaktura system
 * for invoice status changes (accepted, rejected, cancelled, etc.)
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    // CR-06: Fail closed — reject if secret is not configured
    const webhookSecret = Deno.env.get("SEF_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("SEF webhook: SEF_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providedSecret = req.headers.get("x-sef-signature") || req.headers.get("x-webhook-secret");
    if (providedSecret !== webhookSecret) {
      console.warn("SEF webhook: invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    console.log("SEF webhook received:", JSON.stringify(payload));

    // Expected payload structure from SEF:
    // { sefId: string, status: string, timestamp: string, rejectionReason?: string }
    const { status, sefId, timestamp, rejectionReason } = payload;

    // CR-07: Only allow lookup by sefId — prevent UUID enumeration via invoiceId
    if (!sefId) {
      return new Response(JSON.stringify({ error: "Missing sefId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map SEF status to internal status
    const statusMap: Record<string, string> = {
      "Sent": "sent",
      "Delivered": "delivered",
      "Seen": "seen",
      "Approved": "approved",
      "Rejected": "rejected",
      "Cancelled": "cancelled",
      "Storno": "cancelled",
    };

    const mappedStatus = statusMap[status] || status?.toLowerCase() || "unknown";

    // Look up invoice only by SEF ID
    const { data: invoice, error: findErr } = await supabase
      .from("invoices")
      .select("id, tenant_id, sef_status")
      .eq("sef_invoice_id", sefId)
      .maybeSingle();

    if (findErr || !invoice) {
      console.warn(`SEF webhook: invoice not found for sefId=${sefId}`);
      // Return 200 to prevent retries
      return new Response(JSON.stringify({ status: "ignored", reason: "invoice not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update invoice SEF status
    const updateData: Record<string, unknown> = {
      sef_status: mappedStatus,
      sef_updated_at: timestamp || new Date().toISOString(),
    };

    if (rejectionReason) {
      updateData.sef_rejection_reason = rejectionReason;
    }

    const { error: updateErr } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoice.id);

    if (updateErr) {
      console.error("SEF webhook: failed to update invoice", updateErr);
      return new Response(JSON.stringify({ error: "Update failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`SEF webhook: updated invoice ${invoice.id} status to ${mappedStatus}`);

    return new Response(JSON.stringify({ status: "ok", invoiceId: invoice.id, newStatus: mappedStatus }), {
      status: 200, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    });
  } catch (error) {
    return createErrorResponse(error, req, { logPrefix: "sef-webhook" });
  }
});
