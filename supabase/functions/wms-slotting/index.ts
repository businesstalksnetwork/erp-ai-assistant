import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // 1. Fetch bins with zone info
    const { data: bins } = await supabase
      .from("wms_bins")
      .select("id, code, bin_type, max_volume, max_weight, max_units, level, accessibility_score, zone_id, aisle_id, sort_order, wms_zones(name, zone_type, pick_method)")
      .eq("warehouse_id", warehouse_id)
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    // 2. Fetch current bin stock
    const { data: binStock } = await supabase
      .from("wms_bin_stock")
      .select("bin_id, product_id, quantity, received_at")
      .eq("warehouse_id", warehouse_id)
      .eq("tenant_id", tenant_id)
      .eq("status", "available");

    // 3. Fetch pick history (last 90 days) from completed pick tasks
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: pickHistory } = await supabase
      .from("wms_tasks")
      .select("product_id, from_bin_id, completed_at, order_reference")
      .eq("warehouse_id", warehouse_id)
      .eq("tenant_id", tenant_id)
      .eq("task_type", "pick")
      .eq("status", "completed")
      .gte("completed_at", ninetyDaysAgo);

    // 4. Calculate velocity scores (picks per week per SKU)
    const velocityMap: Record<string, number> = {};
    const orderProducts: Record<string, Set<string>> = {};

    for (const pick of pickHistory || []) {
      if (!pick.product_id) continue;
      velocityMap[pick.product_id] = (velocityMap[pick.product_id] || 0) + 1;

      // Track co-occurrence by order
      if (pick.order_reference) {
        if (!orderProducts[pick.order_reference]) {
          orderProducts[pick.order_reference] = new Set();
        }
        orderProducts[pick.order_reference].add(pick.product_id);
      }
    }

    const weeksInRange = 13; // ~90 days
    const velocityScores: Record<string, number> = {};
    for (const [pid, count] of Object.entries(velocityMap)) {
      velocityScores[pid] = Math.round((count / weeksInRange) * 100) / 100;
    }

    // 5. Calculate co-occurrence affinity
    const affinityMap: Record<string, Record<string, number>> = {};
    for (const products of Object.values(orderProducts)) {
      const arr = Array.from(products);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = [arr[i], arr[j]].sort().join("|");
          if (!affinityMap[arr[i]]) affinityMap[arr[i]] = {};
          if (!affinityMap[arr[j]]) affinityMap[arr[j]] = {};
          affinityMap[arr[i]][arr[j]] = (affinityMap[arr[i]][arr[j]] || 0) + 1;
          affinityMap[arr[j]][arr[i]] = (affinityMap[arr[j]][arr[i]] || 0) + 1;
        }
      }
    }

    // 6. Build current placement map
    const currentPlacement: Record<string, string[]> = {};
    for (const bs of binStock || []) {
      if (!currentPlacement[bs.product_id]) currentPlacement[bs.product_id] = [];
      currentPlacement[bs.product_id].push(bs.bin_id);
    }

    // 7. Build bin lookup
    const binLookup: Record<string, any> = {};
    for (const bin of bins || []) {
      binLookup[bin.id] = bin;
    }

    // 8. Call AI for recommendations
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const optimizationWeights = weights || { travel: 0.5, space: 0.3, affinity: 0.2 };

    const topSkus = Object.entries(velocityScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50);

    const binSummary = (bins || []).slice(0, 100).map((b: any) => ({
      id: b.id,
      code: b.code,
      zone: b.wms_zones?.name,
      zone_type: b.wms_zones?.zone_type,
      level: b.level,
      accessibility: b.accessibility_score,
      type: b.bin_type,
    }));

    const prompt = `You are a warehouse slotting optimization AI. Analyze this data and recommend SKU-bin reassignments to minimize pick travel time.

OPTIMIZATION WEIGHTS: Travel=${optimizationWeights.travel}, Space=${optimizationWeights.space}, Affinity=${optimizationWeights.affinity}

TOP SKUs BY VELOCITY (picks/week):
${topSkus.map(([id, v]) => `${id}: ${v} picks/week, current bins: ${(currentPlacement[id] || []).join(", ") || "none"}`).join("\n")}

AVAILABLE BINS:
${JSON.stringify(binSummary)}

CO-OCCURRENCE (top pairs):
${Object.entries(affinityMap).slice(0, 20).map(([pid, pairs]) => {
  const topPair = Object.entries(pairs).sort(([, a], [, b]) => b - a)[0];
  return topPair ? `${pid} <-> ${topPair[0]}: ${topPair[1]} co-picks` : "";
}).filter(Boolean).join("\n")}

Return a JSON object with:
{
  "recommendations": [
    { "product_id": "...", "current_bin": "...", "recommended_bin": "...", "score": 0-100, "reasons": ["reason1", "reason2"] }
  ],
  "estimated_improvement": { "travel_reduction_pct": number, "summary": "..." }
}

Use the tool to return your answer.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a warehouse operations optimization AI. Always respond with actionable slotting recommendations." },
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
