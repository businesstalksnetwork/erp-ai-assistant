import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Anomaly {
  id: string;
  type: "duplicate" | "weekend" | "round_number" | "unusual_vendor" | "outlier";
  severity: "high" | "medium" | "low";
  invoice_id: string;
  invoice_number: string;
  vendor_name: string;
  amount: number;
  date: string;
  description: string;
  confidence: number;
  related_invoice_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify membership
    const { data: mem } = await userClient.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", userId).maybeSingle();
    if (!mem) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch recent invoices (last 90 days) and supplier invoices
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const [invoicesRes, supplierInvRes] = await Promise.all([
      admin.from("invoices").select("id, invoice_number, partner_id, total, invoice_date, status, currency").eq("tenant_id", tenant_id).gte("invoice_date", ninetyDaysAgo).order("invoice_date", { ascending: false }).limit(500),
      admin.from("supplier_invoices").select("id, invoice_number, supplier_id, total_amount, invoice_date, status, currency").eq("tenant_id", tenant_id).gte("invoice_date", ninetyDaysAgo).order("invoice_date", { ascending: false }).limit(500),
    ]);

    const invoices = invoicesRes.data || [];
    const supplierInvoices = supplierInvRes.data || [];

    // Fetch partner names
    const partnerIds = [...new Set([...invoices.map((i: any) => i.partner_id), ...supplierInvoices.map((i: any) => i.supplier_id)].filter(Boolean))];
    const partnersMap: Record<string, string> = {};
    if (partnerIds.length > 0) {
      const { data: partners } = await admin.from("partners").select("id, name").in("id", partnerIds.slice(0, 200));
      (partners || []).forEach((p: any) => { partnersMap[p.id] = p.name; });
    }

    const anomalies: Anomaly[] = [];
    let anomalyIdx = 0;

    // Combine all invoices into a unified list
    const allInvoices = [
      ...invoices.map((i: any) => ({ ...i, source: "invoice", vendor_id: i.partner_id, amount: Number(i.total) })),
      ...supplierInvoices.map((i: any) => ({ ...i, source: "supplier", vendor_id: i.supplier_id, amount: Number(i.total_amount), invoice_number: i.invoice_number })),
    ];

    // 1. Duplicate amounts (same vendor ±7 days)
    for (let i = 0; i < allInvoices.length; i++) {
      for (let j = i + 1; j < allInvoices.length; j++) {
        const a = allInvoices[i], b = allInvoices[j];
        if (a.vendor_id && a.vendor_id === b.vendor_id && Math.abs(a.amount - b.amount) < 0.01 && a.amount > 0) {
          const dayDiff = Math.abs(new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()) / 86400000;
          if (dayDiff <= 7 && dayDiff > 0) {
            anomalies.push({
              id: `anom-${anomalyIdx++}`, type: "duplicate", severity: "high",
              invoice_id: a.id, invoice_number: a.invoice_number || "N/A",
              vendor_name: partnersMap[a.vendor_id] || "Unknown", amount: a.amount,
              date: a.invoice_date, description: `Duplicate amount ${a.amount} with invoice ${b.invoice_number || "N/A"} (${dayDiff.toFixed(0)} days apart)`,
              confidence: 0.85, related_invoice_id: b.id,
            });
          }
        }
      }
    }

    // 2. Weekend invoices
    for (const inv of allInvoices) {
      const day = new Date(inv.invoice_date).getDay();
      if (day === 0 || day === 6) {
        anomalies.push({
          id: `anom-${anomalyIdx++}`, type: "weekend", severity: "low",
          invoice_id: inv.id, invoice_number: inv.invoice_number || "N/A",
          vendor_name: partnersMap[inv.vendor_id] || "Unknown", amount: inv.amount,
          date: inv.invoice_date, description: `Invoice dated on ${day === 0 ? "Sunday" : "Saturday"}`,
          confidence: 0.5,
        });
      }
    }

    // 3. Round number patterns (multiples of 10000)
    for (const inv of allInvoices) {
      if (inv.amount >= 10000 && inv.amount % 10000 === 0) {
        anomalies.push({
          id: `anom-${anomalyIdx++}`, type: "round_number", severity: "low",
          invoice_id: inv.id, invoice_number: inv.invoice_number || "N/A",
          vendor_name: partnersMap[inv.vendor_id] || "Unknown", amount: inv.amount,
          date: inv.invoice_date, description: `Suspiciously round amount: ${inv.amount}`,
          confidence: 0.4,
        });
      }
    }

    // 4. Amount outliers (>3σ from vendor average)
    const vendorAmounts: Record<string, number[]> = {};
    for (const inv of allInvoices) {
      if (inv.vendor_id) {
        if (!vendorAmounts[inv.vendor_id]) vendorAmounts[inv.vendor_id] = [];
        vendorAmounts[inv.vendor_id].push(inv.amount);
      }
    }
    for (const inv of allInvoices) {
      if (!inv.vendor_id) continue;
      const amounts = vendorAmounts[inv.vendor_id];
      if (amounts.length < 3) continue;
      const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      const stddev = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
      if (stddev > 0 && Math.abs(inv.amount - mean) > 3 * stddev) {
        anomalies.push({
          id: `anom-${anomalyIdx++}`, type: "outlier", severity: "high",
          invoice_id: inv.id, invoice_number: inv.invoice_number || "N/A",
          vendor_name: partnersMap[inv.vendor_id] || "Unknown", amount: inv.amount,
          date: inv.invoice_date, description: `Amount ${inv.amount} is ${((inv.amount - mean) / stddev).toFixed(1)}σ from vendor average of ${mean.toFixed(0)}`,
          confidence: 0.9,
        });
      }
    }

    // 5. Unusual vendors (first-time with large amounts)
    const vendorInvCount: Record<string, number> = {};
    for (const inv of allInvoices) {
      if (inv.vendor_id) vendorInvCount[inv.vendor_id] = (vendorInvCount[inv.vendor_id] || 0) + 1;
    }
    const avgAmount = allInvoices.length > 0 ? allInvoices.reduce((s, i) => s + i.amount, 0) / allInvoices.length : 0;
    for (const inv of allInvoices) {
      if (inv.vendor_id && vendorInvCount[inv.vendor_id] === 1 && inv.amount > avgAmount * 2) {
        anomalies.push({
          id: `anom-${anomalyIdx++}`, type: "unusual_vendor", severity: "medium",
          invoice_id: inv.id, invoice_number: inv.invoice_number || "N/A",
          vendor_name: partnersMap[inv.vendor_id] || "Unknown", amount: inv.amount,
          date: inv.invoice_date, description: `First-time vendor with amount ${inv.amount} (2x+ above average of ${avgAmount.toFixed(0)})`,
          confidence: 0.65,
        });
      }
    }

    // Deduplicate by invoice_id + type
    const seen = new Set<string>();
    const uniqueAnomalies = anomalies.filter(a => {
      const key = `${a.invoice_id}-${a.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Send to Gemini for correlation analysis if anomalies found
    let aiNarrative = "";
    if (uniqueAnomalies.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const summaryData = uniqueAnomalies.slice(0, 20).map(a => ({
            type: a.type, severity: a.severity, vendor: a.vendor_name,
            amount: a.amount, description: a.description,
          }));
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "You are a forensic accounting AI. Given invoice anomalies, provide a 3-4 sentence executive summary. Highlight the most concerning patterns and recommend priorities for investigation. Be specific." },
                { role: "user", content: JSON.stringify(summaryData) },
              ],
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            aiNarrative = aiData.choices?.[0]?.message?.content || "";
          }
        } catch (e) { console.error("AI enrichment failed:", e); }
      }
    }

    // Log to ai_action_log
    await admin.from("ai_action_log").insert({
      tenant_id, module: "accounting", action_type: "invoice_anomaly_scan",
      ai_output: { anomaly_count: uniqueAnomalies.length, types: [...new Set(uniqueAnomalies.map(a => a.type))] },
      model_version: "google/gemini-3-flash-preview", user_id: userId,
      confidence_score: uniqueAnomalies.length > 0 ? uniqueAnomalies.reduce((s, a) => s + a.confidence, 0) / uniqueAnomalies.length : 1,
    });

    return new Response(JSON.stringify({
      anomalies: uniqueAnomalies.sort((a, b) => { const sev = { high: 0, medium: 1, low: 2 }; return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2); }),
      narrative: aiNarrative,
      summary: {
        total: uniqueAnomalies.length,
        high: uniqueAnomalies.filter(a => a.severity === "high").length,
        medium: uniqueAnomalies.filter(a => a.severity === "medium").length,
        low: uniqueAnomalies.filter(a => a.severity === "low").length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-invoice-anomaly error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
