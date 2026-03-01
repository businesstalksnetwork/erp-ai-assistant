import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: mem } = await userClient.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", userId).maybeSingle();
    if (!mem) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch suppliers (partners with is_supplier)
    const { data: suppliers } = await admin.from("partners").select("id, name, payment_terms")
      .eq("tenant_id", tenant_id).eq("is_supplier", true).eq("status", "active").limit(100);

    if (!suppliers || suppliers.length === 0) {
      return new Response(JSON.stringify({ suppliers: [], narrative: "No active suppliers found." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supplierIds = suppliers.map((s: any) => s.id);

    // Fetch purchase orders, supplier invoices, goods receipts in parallel
    const [posRes, siRes, grRes] = await Promise.all([
      admin.from("purchase_orders").select("id, supplier_id, status, expected_delivery_date, total, created_at").eq("tenant_id", tenant_id).in("supplier_id", supplierIds).limit(1000),
      admin.from("supplier_invoices").select("id, supplier_id, total_amount, invoice_date, status").eq("tenant_id", tenant_id).in("supplier_id", supplierIds).limit(1000),
      admin.from("goods_receipts").select("id, supplier_id, status, received_date, purchase_order_id").eq("tenant_id", tenant_id).in("supplier_id", supplierIds).limit(1000),
    ]);

    const purchaseOrders = posRes.data || [];
    const supplierInvoices = siRes.data || [];
    const goodsReceipts = grRes.data || [];

    // Score each supplier
    const scoredSuppliers = suppliers.map((supplier: any) => {
      const sPOs = purchaseOrders.filter((po: any) => po.supplier_id === supplier.id);
      const sSIs = supplierInvoices.filter((si: any) => si.supplier_id === supplier.id);
      const sGRs = goodsReceipts.filter((gr: any) => gr.supplier_id === supplier.id);

      // 1. Delivery reliability (0-100)
      let deliveryScore = 50;
      if (sPOs.length > 0) {
        const delivered = sPOs.filter((po: any) => po.status === "received" || po.status === "completed");
        deliveryScore = sPOs.length > 0 ? Math.round((delivered.length / sPOs.length) * 100) : 50;
      }

      // 2. Price stability (0-100) — based on invoice amount variance
      let priceScore = 70;
      if (sSIs.length >= 3) {
        const amounts = sSIs.map((si: any) => Number(si.total_amount));
        const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
        const cv = mean > 0 ? Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length) / mean : 0;
        priceScore = Math.max(0, Math.min(100, Math.round(100 - cv * 200)));
      }

      // 3. Payment flexibility (0-100) — based on payment terms
      const terms = parseInt(supplier.payment_terms) || 30;
      const paymentScore = Math.min(100, Math.round(terms * 1.5));

      // 4. Quality (0-100) — based on goods receipt acceptance
      let qualityScore = 75;
      if (sGRs.length > 0) {
        const accepted = sGRs.filter((gr: any) => gr.status === "completed" || gr.status === "accepted");
        qualityScore = Math.round((accepted.length / sGRs.length) * 100);
      }

      const totalSpend = sSIs.reduce((s: number, si: any) => s + Number(si.total_amount), 0);
      const composite = Math.round((deliveryScore * 0.3 + priceScore * 0.25 + paymentScore * 0.2 + qualityScore * 0.25));

      return {
        id: supplier.id, name: supplier.name, composite_score: composite,
        delivery_score: deliveryScore, price_score: priceScore,
        payment_score: paymentScore, quality_score: qualityScore,
        total_spend: totalSpend, order_count: sPOs.length, invoice_count: sSIs.length,
        recommendation: "",
      };
    });

    scoredSuppliers.sort((a: any, b: any) => b.composite_score - a.composite_score);

    // AI recommendations
    let aiNarrative = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && scoredSuppliers.length > 0) {
      try {
        const top10 = scoredSuppliers.slice(0, 10).map((s: any) => ({
          name: s.name, score: s.composite_score,
          delivery: s.delivery_score, price: s.price_score,
          quality: s.quality_score, spend: s.total_spend,
        }));
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            tools: [{
              type: "function",
              function: {
                name: "supplier_recommendations",
                description: "Return strategic recommendations for each supplier",
                parameters: {
                  type: "object",
                  properties: {
                    recommendations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          supplier_name: { type: "string" },
                          recommendation: { type: "string" },
                        },
                        required: ["supplier_name", "recommendation"],
                        additionalProperties: false,
                      },
                    },
                    summary: { type: "string" },
                  },
                  required: ["recommendations", "summary"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "supplier_recommendations" } },
            messages: [
              { role: "system", content: "You are a procurement strategist AI. Given supplier scores, provide 1-sentence strategic recommendation per supplier and a 2-sentence overall summary." },
              { role: "user", content: JSON.stringify(top10) },
            ],
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            aiNarrative = parsed.summary || "";
            for (const rec of (parsed.recommendations || [])) {
              const match = scoredSuppliers.find((s: any) => s.name === rec.supplier_name);
              if (match) match.recommendation = rec.recommendation;
            }
          }
        }
      } catch (e) { console.error("AI enrichment failed:", e); }
    }

    await admin.from("ai_action_log").insert({
      tenant_id, module: "purchasing", action_type: "supplier_scoring",
      ai_output: { supplier_count: scoredSuppliers.length, avg_score: Math.round(scoredSuppliers.reduce((s: number, x: any) => s + x.composite_score, 0) / (scoredSuppliers.length || 1)) },
      model_version: "google/gemini-3-flash-preview", user_id: userId,
    });

    return new Response(JSON.stringify({ suppliers: scoredSuppliers, narrative: aiNarrative }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-supplier-scoring error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
