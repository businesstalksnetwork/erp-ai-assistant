import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PFR payment type mapping
const PAYMENT_TYPE_MAP: Record<string, number> = {
  other: 0, cash: 1, card: 2, check: 3, wire_transfer: 4, voucher: 5, mobile: 6,
};

// Default tax label mapping per Pravilnik: A=20%, B=10% reduced, G=0% exempt
const DEFAULT_TAX_LABEL_MAP: Record<string, string> = {
  "20": "A", "10": "B", "0": "G",
};

function resolveTaxLabel(taxRate: number, deviceMap: Record<string, string> | null): string {
  const map = { ...DEFAULT_TAX_LABEL_MAP, ...(deviceMap || {}) };
  return map[String(taxRate)] || "A";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const caller = { id: claimsData.claims.sub as string };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();
    const {
      transaction_id, tenant_id, device_id, items, payments,
      buyer_id, receipt_type = "normal", transaction_type = "sale",
      referent_receipt_number, referent_receipt_date, cashier_name,
      environment_type, omit_qr_code, journal_report, voucher_type,
    } = body;

    // Verify tenant_id is provided
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load fiscal device config (scoped to tenant)
    const { data: device, error: deviceErr } = await supabase
      .from("fiscal_devices")
      .select("*")
      .eq("id", device_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (deviceErr || !device) {
      return new Response(JSON.stringify({ error: "Fiscal device not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!device.api_url) {
      return new Response(JSON.stringify({ error: "PFR API URL not configured for this device" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve tax label map from device config (configurable per device)
    const taxLabelMap: Record<string, string> | null = device.tax_label_map as Record<string, string> | null;

    // Build PFR InvoiceRequest
    const now = new Date();
    const invoiceRequest: Record<string, unknown> = {
      dateAndTimeOfIssue: now.toISOString(),
      cashier: cashier_name || "Prodavac",
      invoiceType: receipt_type === "normal" ? "Normal" : receipt_type === "proforma" ? "Proforma" : receipt_type === "copy" ? "Copy" : "Training",
      transactionType: transaction_type === "sale" ? "Sale" : "Refund",
      payment: payments.map((p: { amount: number; method: string }) => ({
        amount: p.amount,
        paymentType: PAYMENT_TYPE_MAP[p.method] ?? 0,
      })),
      items: items.map((item: { name: string; quantity: number; unit_price: number; tax_rate: number; total_amount: number }) => {
        // Multi-purpose voucher sale: use tax category "O" (outside scope), no VAT
        const label = voucher_type === "multi_purpose"
          ? "O"
          : resolveTaxLabel(item.tax_rate, taxLabelMap);
        return {
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          labels: [label],
          totalAmount: item.total_amount,
        };
      }),
    };

    // PFR v3 optional fields
    if (environment_type) invoiceRequest.options = { ...(invoiceRequest.options as Record<string, unknown> || {}), OmitTextualRepresentation: false };
    if (environment_type) invoiceRequest.environmentType = environment_type; // "Production" or "Sandbox"
    if (omit_qr_code) invoiceRequest.options = { ...(invoiceRequest.options as Record<string, unknown> || {}), OmitQRCodeGen: 1 };

    if (buyer_id) invoiceRequest.buyerId = buyer_id;

    // For refunds, reference original receipt
    if (transaction_type === "refund" && referent_receipt_number) {
      invoiceRequest.referentDocumentNumber = referent_receipt_number;
      invoiceRequest.referentDocumentDT = referent_receipt_date || now.toISOString();
    }

    // Calculate totals for tax breakdown
    const taxGroups: Record<string, { rate: number; base: number; amount: number }> = {};
    for (const item of items) {
      const label = resolveTaxLabel(item.tax_rate, taxLabelMap);
      const base = item.unit_price * item.quantity;
      const taxAmt = base * (item.tax_rate / 100);
      if (!taxGroups[label]) taxGroups[label] = { rate: item.tax_rate, base: 0, amount: 0 };
      taxGroups[label].base += base;
      taxGroups[label].amount += taxAmt;
    }
    const taxItems = Object.entries(taxGroups).map(([label, data]) => ({ label, ...data }));
    const totalAmount = items.reduce((s: number, i: any) => s + i.total_amount, 0);

    // Generate requestId for timeout recovery
    const requestId = crypto.randomUUID();

    // POST to PFR API with timeout + requestId header
    let pfrResponse: Record<string, unknown> = {};
    let receiptNumber = "";
    let qrCodeUrl = "";
    let signedAt = now.toISOString();
    let isOffline = false;

    try {
      const pfrRes = await fetch(`${device.api_url}/api/v3/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(device.pac ? { "PAC": device.pac } : {}),
          "RequestId": requestId,
        },
        body: JSON.stringify(invoiceRequest),
        signal: AbortSignal.timeout(10000),
      });
      pfrResponse = await pfrRes.json();
      receiptNumber = (pfrResponse as any).invoiceNumber || `FR-${Date.now()}`;
      qrCodeUrl = (pfrResponse as any).verificationUrl || "";
      signedAt = (pfrResponse as any).sdcDateTime || now.toISOString();
    } catch (postErr) {
      // POST failed (timeout or network) -- attempt GET status check
      console.error("PFR POST error, attempting GET recovery:", postErr);
      try {
        const getRes = await fetch(`${device.api_url}/api/v3/invoices/${requestId}`, {
          method: "GET",
          headers: {
            ...(device.pac ? { "PAC": device.pac } : {}),
          },
          signal: AbortSignal.timeout(5000),
        });
        if (getRes.ok) {
          const getBody = await getRes.json();
          if (getBody.invoiceNumber) {
            // Receipt was actually signed by SDC
            console.log("GET recovery successful, receipt was signed:", getBody.invoiceNumber);
            pfrResponse = getBody;
            receiptNumber = getBody.invoiceNumber;
            qrCodeUrl = getBody.verificationUrl || "";
            signedAt = getBody.sdcDateTime || now.toISOString();
          } else {
            // GET returned but no invoice -- truly offline
            isOffline = true;
          }
        } else {
          isOffline = true;
        }
      } catch (getErr) {
        console.error("GET recovery also failed:", getErr);
        isOffline = true;
      }

      if (isOffline) {
        receiptNumber = `OFFLINE-${Date.now()}`;
        pfrResponse = { error: "PFR not reachable", offline: true };
      }
    }

    // Store fiscal receipt (with request_id for retry correlation)
    const { data: receipt, error: receiptErr } = await supabase
      .from("fiscal_receipts")
      .insert({
        tenant_id,
        fiscal_device_id: device_id,
        pos_transaction_id: transaction_id || null,
        receipt_type,
        transaction_type,
        receipt_number: receiptNumber,
        total_amount: totalAmount,
        tax_items: taxItems,
        payment_method: payments[0]?.method || "cash",
        buyer_id: buyer_id || null,
        pfr_request: invoiceRequest,
        pfr_response: pfrResponse,
        qr_code_url: qrCodeUrl || null,
        signed_at: signedAt,
        request_id: requestId,
      })
      .select()
      .single();

    if (receiptErr) {
      console.error("Error storing fiscal receipt:", receiptErr);
    }

    // Update pos_transaction with fiscal receipt number
    if (transaction_id) {
      await supabase
        .from("pos_transactions")
        .update({ fiscal_receipt_number: receiptNumber, fiscal_device_id: device_id })
        .eq("id", transaction_id);
    }

    // If journal_report requested, call PFR journal endpoint for end-of-day reconciliation
    if (journal_report && device.api_url) {
      try {
        const journalRes = await fetch(`${device.api_url}/api/v3/invoices/journal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(device.pac ? { "PAC": device.pac } : {}),
          },
          body: JSON.stringify({ dateFrom: journal_report.date_from, dateTo: journal_report.date_to }),
          signal: AbortSignal.timeout(10000),
        });
        const journalData = journalRes.ok ? await journalRes.json() : null;
        return new Response(JSON.stringify({
          success: true,
          journal: journalData,
          receipt_id: receipt?.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (journalErr) {
        console.error("Journal endpoint error:", journalErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      receipt_number: receiptNumber,
      qr_code_url: qrCodeUrl,
      signed_at: signedAt,
      receipt_id: receipt?.id,
      offline: isOffline,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Fiscalization error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
