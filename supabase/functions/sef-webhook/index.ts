import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * SEF Webhook handler — receives push notifications from Serbian eFaktura system
 * for invoice status changes (accepted, rejected, cancelled, etc.)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SEF webhooks may use a shared secret for verification
    const webhookSecret = Deno.env.get("SEF_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-sef-signature") || req.headers.get("x-webhook-secret");
    
    if (webhookSecret && providedSecret !== webhookSecret) {
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
    // { invoiceId: string, status: string, sefId: string, timestamp: string, ... }
    const { invoiceId, status, sefId, timestamp, rejectionReason } = payload;

    if (!invoiceId && !sefId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId or sefId" }), {
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

    // Try to find invoice by SEF ID or internal ID
    let query = supabase.from("invoices").select("id, tenant_id, sef_status");
    
    if (sefId) {
      query = query.eq("sef_invoice_id", sefId);
    } else if (invoiceId) {
      query = query.eq("id", invoiceId);
    }

    const { data: invoice, error: findErr } = await query.maybeSingle();

    if (findErr || !invoice) {
      console.warn(`SEF webhook: invoice not found for sefId=${sefId}, invoiceId=${invoiceId}`);
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
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SEF webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
