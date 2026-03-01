import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);



  try {
    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { warehouse_id, tenant_id, weights } = await req.json();

    if (!warehouse_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "warehouse_id and tenant_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Refresh precomputed stats
    await Promise.all([
      supabase.rpc("refresh_wms_product_stats", { p_tenant_id: tenant_id, p_warehouse_id: warehouse_id }),
      supabase.rpc("refresh_wms_affinity_pairs", { p_tenant_id: tenant_id, p_warehouse_id: warehouse_id }),
    ]);

    // 2. Fetch precomputed velocity from wms_product_stats
    const { data: productStats } = await supabase
      .from("wms_product_stats")
      .select("product_id, picks_last_90d, velocity_score")
      .eq("warehouse_id", warehouse_id)
      .eq("tenant_id", tenant_id)
      .gt("picks_last_90d", 0)
      .order("velocity_score", { ascending: false })
      .limit(50);

    // 3. Fetch precomputed affinity from wms_affinity_pairs
    const { data: affinityPairs } = await supabase
      .from("wms_affinity_pairs")
      .select("product_a_id, product_b_id, co_pick_count")
      .eq("warehouse_id", warehouse_id)
      .eq("tenant_id", tenant_id)
      .order("co_pick_count", { ascending: false })
      .limit(20);

    // 4. Fetch active bins with available capacity
    const { data: bins } = await supabase
      .from("wms_bins")
      .select("id, code, bin_type, max_volume, max_weight, max_units, level, accessibility_score, zone_id, aisle_id, sort_order, wms_zones(name, zone_type, pick_method)")
      .eq("warehouse_id", warehouse_id)
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .gt("accessibility_score", 0)
      .order("accessibility_score", { ascending: false })
      .limit(200);

    // 5. Fetch current bin stock
    const { data: binStock } = await supabase
      .from("wms_bin_stock")
      .select("bin_id, product_id, quantity, received_at")
      .eq("warehouse_id", warehouse_id)
      .eq("tenant_id", tenant_id)
      .eq("status", "available");

    // 6. Build current placement + stock quantity maps
    const currentPlacement: Record<string, string[]> = {};
    const binStockQty: Record<string, number> = {};
    for (const bs of binStock || []) {
      if (!currentPlacement[bs.product_id]) currentPlacement[bs.product_id] = [];
      currentPlacement[bs.product_id].push(bs.bin_id);
      binStockQty[bs.bin_id] = (binStockQty[bs.bin_id] || 0) + (bs.quantity || 0);
    }

    // 7. Build bin lookup with available capacity
    const binLookup: Record<string, any> = {};
    for (const bin of bins || []) {
      const currentQty = binStockQty[bin.id] || 0;
      const availableUnits = (bin.max_units || 9999) - currentQty;
      binLookup[bin.id] = { ...bin, current_qty: currentQty, available_units: availableUnits };
    }

    // 8. Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const optimizationWeights = weights || { travel: 0.5, space: 0.3, affinity: 0.2 };

    const topSkus = (productStats || []).map((ps: any) => ({
      id: ps.product_id,
      velocity: ps.velocity_score,
      picks: ps.picks_last_90d,
    }));

    const binsWithCapacity = Object.values(binLookup)
      .filter((b: any) => b.available_units > 0)
      .sort((a: any, b: any) => b.accessibility_score - a.accessibility_score)
      .slice(0, 100);

    const binSummary = binsWithCapacity.map((b: any) => ({
      id: b.id, code: b.code, zone: b.wms_zones?.name, zone_type: b.wms_zones?.zone_type,
      level: b.level, accessibility: b.accessibility_score, type: b.bin_type,
      available_units: b.available_units, max_units: b.max_units,
    }));

    const prompt = `You are a warehouse slotting optimization AI. Analyze this data and recommend SKU-bin reassignments to minimize pick travel time.

OPTIMIZATION WEIGHTS: Travel=${optimizationWeights.travel}, Space=${optimizationWeights.space}, Affinity=${optimizationWeights.affinity}

IMPORTANT CONSTRAINTS:
- Each recommended bin must have enough available_units for the product
- Do NOT recommend bins that are at capacity
- Prefer bins with higher accessibility scores for high-velocity SKUs

TOP SKUs BY VELOCITY (picks/week):
${topSkus.map((s: any) => `${s.id}: ${s.velocity} picks/week (${s.picks} in 90d), current bins: ${(currentPlacement[s.id] || []).join(", ") || "none"}`).join("\n")}

AVAILABLE BINS (with capacity):
${JSON.stringify(binSummary)}

CO-OCCURRENCE (top pairs):
${(affinityPairs || []).map((p: any) => `${p.product_a_id} <-> ${p.product_b_id}: ${p.co_pick_count} co-picks`).join("\n")}

Return a JSON object with:
{
  "recommendations": [
    { "product_id": "...", "current_bin": "...", "recommended_bin": "...", "score": 0-100, "reasons": ["reason1", "reason2"] }
  ],
  "estimated_improvement": { "travel_reduction_pct": number, "summary": "..." }
}

Use the tool to return your answer.`;

    const MODEL = "google/gemini-3-flash-preview";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You are a warehouse operations optimization AI. Always respond with actionable slotting recommendations. Respect bin capacity constraints." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "slotting_recommendations",
              description: "Return slotting recommendations for warehouse optimization",
              parameters: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        product_id: { type: "string" },
                        current_bin: { type: "string" },
                        recommended_bin: { type: "string" },
                        score: { type: "number" },
                        reasons: { type: "array", items: { type: "string" } },
                      },
                      required: ["product_id", "recommended_bin", "score", "reasons"],
                    },
                  },
                  estimated_improvement: {
                    type: "object",
                    properties: {
                      travel_reduction_pct: { type: "number" },
                      summary: { type: "string" },
                    },
                    required: ["travel_reduction_pct", "summary"],
                  },
                },
                required: ["recommendations", "estimated_improvement"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "slotting_recommendations" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let result;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      result = JSON.parse(toolCall.function.arguments);
    } catch {
      result = { recommendations: [], estimated_improvement: { travel_reduction_pct: 0, summary: "Unable to parse AI response" } };
    }

    // Post-AI validation: filter out recommendations that violate bin capacity
    if (result.recommendations?.length > 0) {
      const validRecs: any[] = [];
      const rejectedCount = { capacity: 0 };
      
      for (const rec of result.recommendations) {
        const targetBin = binLookup[rec.recommended_bin];
        if (!targetBin) {
          const binByCode = Object.values(binLookup).find((b: any) => b.code === rec.recommended_bin);
          if (binByCode && (binByCode as any).available_units > 0) {
            rec.recommended_bin = (binByCode as any).id;
            validRecs.push(rec);
          } else {
            rejectedCount.capacity++;
          }
          continue;
        }
        if (targetBin.available_units <= 0) {
          rejectedCount.capacity++;
          continue;
        }
        validRecs.push(rec);
      }

      result.recommendations = validRecs;
      if (rejectedCount.capacity > 0) {
        result.estimated_improvement.summary += ` (${rejectedCount.capacity} recommendations rejected due to bin capacity constraints)`;
      }
    }

    // Audit log
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id,
        user_id: caller.id,
        action_type: "slotting_optimization",
        module: "wms",
        model_version: MODEL,
        reasoning: `WMS slotting: ${result.recommendations?.length || 0} recommendations, ${result.estimated_improvement?.travel_reduction_pct || 0}% travel reduction`,
      });
    } catch (logErr) {
      console.warn("Failed to log AI action:", logErr);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wms-slotting error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
