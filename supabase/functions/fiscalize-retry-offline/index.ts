import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get offline receipts (max 5 retries), ordered by retry_count ASC for fairness
    const { data: offlineReceipts } = await supabase
      .from("fiscal_receipts")
      .select("*, fiscal_devices(api_url, pac)")
      .eq("tenant_id", tenant_id)
      .like("receipt_number", "OFFLINE-%")
      .lt("retry_count", 5)
      .order("retry_count", { ascending: true })
      .order("created_at");

    if (!offlineReceipts || offlineReceipts.length === 0) {
      return new Response(JSON.stringify({ success: true, retried: 0, message: "No offline receipts to retry" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: any[] = [];

    for (const receipt of offlineReceipts) {
      const device = receipt.fiscal_devices as any;
      if (!device?.api_url) {
        results.push({ id: receipt.id, status: "skipped", reason: "No PFR URL" });
        continue;
      }

      // Exponential backoff: skip if last_retry_at is too recent
      // Delay = 2^retry_count seconds (1s, 2s, 4s, 8s, 16s)
      if (receipt.last_retry_at && receipt.retry_count > 0) {
        const backoffMs = Math.pow(2, receipt.retry_count) * 1000;
        const lastRetry = new Date(receipt.last_retry_at).getTime();
        if (Date.now() - lastRetry < backoffMs) {
          results.push({ id: receipt.id, status: "skipped", reason: "backoff" });
          continue;
        }
      }

      try {
        // Step 1: If we have a request_id, first try GET to check if original was processed
        if (receipt.request_id) {
          try {
            const getRes = await fetch(`${device.api_url}/api/v3/invoices/${receipt.request_id}`, {
              method: "GET",
              headers: { ...(device.pac ? { "PAC": device.pac } : {}) },
              signal: AbortSignal.timeout(5000),
            });
            if (getRes.ok) {
              const getBody = await getRes.json();
              if (getBody.invoiceNumber) {
                // Original was actually signed -- update receipt, no re-POST needed
                await supabase.from("fiscal_receipts").update({
                  receipt_number: getBody.invoiceNumber,
                  qr_code_url: getBody.verificationUrl || null,
                  signed_at: getBody.sdcDateTime || new Date().toISOString(),
                  pfr_response: getBody,
                  retry_count: receipt.retry_count + 1,
                  last_retry_at: new Date().toISOString(),
                  verification_status: "verified",
                }).eq("id", receipt.id);

                results.push({ id: receipt.id, status: "recovered_via_get", receipt_number: getBody.invoiceNumber });
                continue;
              }
            }
          } catch {
            // GET failed, proceed to POST retry
          }
        }

        // Step 2: POST retry (original was not processed)
        const pfrPayload = receipt.pfr_request || {};
        const newRequestId = crypto.randomUUID();
        const res = await fetch(`${device.api_url}/api/v3/invoices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "PAC": device.pac || "",
            "RequestId": newRequestId,
          },
          body: JSON.stringify(pfrPayload),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const pfrResponse = await res.json();
          await supabase.from("fiscal_receipts").update({
            receipt_number: pfrResponse.invoiceNumber || receipt.receipt_number,
            qr_code_url: pfrResponse.verificationUrl || null,
            signed_at: new Date().toISOString(),
            pfr_response: pfrResponse,
            retry_count: receipt.retry_count + 1,
            last_retry_at: new Date().toISOString(),
            verification_status: "verified",
            request_id: newRequestId,
          }).eq("id", receipt.id);

          results.push({ id: receipt.id, status: "success", receipt_number: pfrResponse.invoiceNumber });
        } else {
          await supabase.from("fiscal_receipts").update({
            retry_count: receipt.retry_count + 1,
            last_retry_at: new Date().toISOString(),
            verification_status: receipt.retry_count + 1 >= 5 ? "failed" : "pending",
            request_id: newRequestId,
          }).eq("id", receipt.id);

          results.push({ id: receipt.id, status: "failed", http_status: res.status });
        }
      } catch (err) {
        await supabase.from("fiscal_receipts").update({
          retry_count: receipt.retry_count + 1,
          last_retry_at: new Date().toISOString(),
        }).eq("id", receipt.id);

        results.push({ id: receipt.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, retried: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
