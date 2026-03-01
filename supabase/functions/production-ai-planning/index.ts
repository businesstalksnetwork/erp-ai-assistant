import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, tenant_id, language, scenario_params, locked_order_ids, excluded_order_ids, scenario_name, scenario_data } = await req.json();

    if (!tenant_id || !action) {
      return new Response(JSON.stringify({ error: "tenant_id and action are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle non-AI actions first
    if (action === "save-scenario") {
      const { error } = await supabase.from("production_scenarios").insert({
        tenant_id,
        name: scenario_name || "Unnamed",
        scenario_type: scenario_data?.scenario_type || "simulation",
        params: scenario_data?.params || {},
        result: scenario_data?.result || {},
        created_by: caller.id,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list-scenarios") {
      const { data, error } = await supabase.from("production_scenarios")
        .select("*").eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ scenarios: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch production data
    const [ordersRes, bomsRes, stockRes, wasteRes] = await Promise.all([
      supabase.from("production_orders").select("*, bom_template:bom_templates(name, product_id)").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("bom_templates").select("*, bom_lines(*, material:products(name, sku))").eq("tenant_id", tenant_id).eq("is_active", true),
      supabase.from("inventory_stock").select("*, product:products(name, sku), warehouse:warehouses(name)").eq("tenant_id", tenant_id),
      supabase.from("production_waste").select("*, product:products(name), production_order:production_orders(order_number)").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(200),
    ]);

    const allOrders = ordersRes.data || [];
    const boms = bomsRes.data || [];
    const stock = stockRes.data || [];
    const wasteRecords = wasteRes.data || [];

    // Filter out excluded orders for AI context
    const excludedSet = new Set(excluded_order_ids || []);
    const lockedSet = new Set(locked_order_ids || []);
    const orders = allOrders.filter(o => !excludedSet.has(o.id));

    const lang = language === "sr" ? "Serbian" : "English";
    const today = new Date().toISOString().split("T")[0];

    // Local fallback scheduler (no AI call)
    if (action === "local-fallback-schedule") {
      const activeOrders = orders.filter(o => o.status !== "completed" && o.status !== "cancelled" && !lockedSet.has(o.id));
      // Sort by priority ASC, then planned_end ASC (earliest due date)
      activeOrders.sort((a, b) => {
        const pa = (a as any).priority || 3;
        const pb = (b as any).priority || 3;
        if (pa !== pb) return pa - pb;
        const da = a.planned_end || "9999-12-31";
        const db = b.planned_end || "9999-12-31";
        return da.localeCompare(db);
      });

      let currentDate = new Date(today);
      const suggestions = activeOrders.map(o => {
        const qty = Number(o.quantity) || 1;
        const durationDays = Math.max(Math.ceil(qty / 10), 1); // rough: 10 units/day
        const startDate = new Date(currentDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + durationDays);
        currentDate = new Date(endDate); // next order starts after this
        return {
          order_id: o.id,
          order_number: o.order_number || o.id.substring(0, 8),
          suggested_start: startDate.toISOString().split("T")[0],
          suggested_end: endDate.toISOString().split("T")[0],
          priority: (o as any).priority || 3,
          explanation: lang === "Serbian"
            ? `Raspoređeno po prioritetu ${(o as any).priority || 3}, trajanje ~${durationDays}d`
            : `Scheduled by priority ${(o as any).priority || 3}, duration ~${durationDays}d`,
        };
      });

      return new Response(JSON.stringify({
        suggestions,
        overall_explanation: lang === "Serbian"
          ? "Lokalni raspored: nalozi su poređani po prioritetu i roku, bez AI poziva."
          : "Local schedule: orders sorted by priority and due date, no AI call.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const dataContext = `
Today's date: ${today}

Production Orders (${orders.length} total, ${lockedSet.size} locked):
${JSON.stringify(orders.slice(0, 50).map(o => ({
  id: o.id, order_number: o.order_number, status: o.status,
  planned_start: o.planned_start, planned_end: o.planned_end,
  quantity: o.quantity, priority: (o as any).priority || 3,
  bom: o.bom_template?.name,
  locked: lockedSet.has(o.id),
  actual_material_cost: (o as any).actual_material_cost,
  actual_labor_cost: (o as any).actual_labor_cost,
  unit_production_cost: (o as any).unit_production_cost,
})), null, 2)}

BOM Templates (${boms.length}):
${JSON.stringify(boms.map(b => ({
  name: b.name, product_id: b.product_id,
  materials: b.bom_lines?.map((l: any) => ({ material: l.material?.name, qty: l.quantity, unit: l.unit }))
})), null, 2)}

Inventory Stock (${stock.length} entries):
${JSON.stringify(stock.slice(0, 50).map(s => ({
  product: s.product?.name, warehouse: s.warehouse?.name,
  on_hand: s.quantity_on_hand, reserved: s.quantity_reserved, min_level: s.min_stock_level
})), null, 2)}

Production Waste (${wasteRecords.length} records):
${JSON.stringify(wasteRecords.slice(0, 50).map((w: any) => ({
  product: w.product?.name, order: w.production_order?.order_number,
  quantity: w.quantity, reason: w.reason, date: w.created_at?.split("T")[0],
})), null, 2)}`;

    let systemPrompt = "";
    let tools: any[] = [];
    let toolChoice: any = undefined;

    if (action === "dashboard-insights") {
      systemPrompt = `You are a production planning AI analyst. Analyze the production data and provide KPI insights. Respond in ${lang}.`;
      tools = [{
        type: "function",
        function: {
          name: "provide_dashboard_insights",
          description: "Return production KPIs and insights",
          parameters: {
            type: "object",
            properties: {
              schedule_adherence_pct: { type: "number", description: "Percentage of orders on schedule (0-100)" },
              capacity_utilization_pct: { type: "number", description: "Estimated capacity utilization (0-100)" },
              active_orders: { type: "number" },
              late_orders: { type: "number" },
              insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    severity: { type: "string", enum: ["critical", "warning", "info"] },
                    title: { type: "string" },
                    description: { type: "string" }
                  },
                  required: ["severity", "title", "description"],
                  additionalProperties: false
                }
              }
            },
            required: ["schedule_adherence_pct", "capacity_utilization_pct", "active_orders", "late_orders", "insights"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "provide_dashboard_insights" } };
    } else if (action === "generate-schedule") {
      systemPrompt = `You are a production scheduling optimizer. Analyze the orders, BOMs, and inventory to suggest an optimized production schedule. Today is ${today}. Do NOT suggest start dates in the past. Orders marked as "locked" should NOT appear in your suggestions. Respect order priority (1=highest, 5=lowest). Respond in ${lang}.`;
      tools = [{
        type: "function",
        function: {
          name: "provide_schedule",
          description: "Return an optimized production schedule",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    order_id: { type: "string" },
                    order_number: { type: "string" },
                    suggested_start: { type: "string", description: "ISO date, must be >= today" },
                    suggested_end: { type: "string", description: "ISO date, must be > suggested_start" },
                    priority: { type: "number", description: "1=highest" },
                    explanation: { type: "string" }
                  },
                  required: ["order_id", "order_number", "suggested_start", "suggested_end", "priority", "explanation"],
                  additionalProperties: false
                }
              },
              overall_explanation: { type: "string" }
            },
            required: ["suggestions", "overall_explanation"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "provide_schedule" } };
    } else if (action === "predict-bottlenecks") {
      systemPrompt = `You are a production bottleneck prediction AI. Cross-reference BOM material needs with inventory stock and analyze order scheduling to identify bottlenecks. Today is ${today}. Consider order priorities. Respond in ${lang}.`;
      tools = [{
        type: "function",
        function: {
          name: "provide_bottlenecks",
          description: "Return predicted production bottlenecks",
          parameters: {
            type: "object",
            properties: {
              bottlenecks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["material_shortage", "overloaded_period", "late_order_risk"] },
                    severity: { type: "string", enum: ["critical", "warning", "info"] },
                    title: { type: "string" },
                    description: { type: "string" },
                    suggested_action: { type: "string" },
                    affected_orders: { type: "array", items: { type: "string" } },
                    material_detail: {
                      type: "object",
                      properties: {
                        product: { type: "string" },
                        required: { type: "number" },
                        available: { type: "number" },
                        deficit: { type: "number" }
                      },
                      required: ["product", "required", "available", "deficit"],
                      additionalProperties: false
                    }
                  },
                  required: ["type", "severity", "title", "description", "suggested_action"],
                  additionalProperties: false
                }
              }
            },
            required: ["bottlenecks"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "provide_bottlenecks" } };
    } else if (action === "simulate-scenario") {
      // PROD-AI-8: Compute real baseline from actual data instead of hallucinating
      const totalOrders = orders.length;
      const completedOrders = orders.filter((o: any) => o.status === "completed").length;
      const inProgressOrders = orders.filter((o: any) => o.status === "in_progress").length;
      const lateOrders = orders.filter((o: any) => {
        if (!o.planned_end) return false;
        return new Date(o.planned_end) < new Date(today) && o.status !== "completed";
      }).length;
      const onTimeRate = totalOrders > 0 ? ((totalOrders - lateOrders) / totalOrders) * 100 : 100;
      const utilization = totalOrders > 0 ? ((completedOrders + inProgressOrders) / Math.max(totalOrders, 1)) * 100 : 0;
      const realBaseline = {
        utilization_pct: Math.round(utilization * 10) / 10,
        on_time_rate_pct: Math.round(onTimeRate * 10) / 10,
        wip_count: inProgressOrders,
        throughput_per_day: completedOrders > 0 ? Math.round((completedOrders / 30) * 10) / 10 : 0,
      };

      systemPrompt = `You are a capacity simulation AI. Given the current production data and the scenario adjustments, project how the scenario would change the KPIs from the real baseline. Today is ${today}. Respond in ${lang}.
Real baseline KPIs (computed from actual data — do NOT change these): ${JSON.stringify(realBaseline)}
Scenario adjustments: ${JSON.stringify(scenario_params || {})}
Return the baseline exactly as provided, and project the scenario KPIs based on the adjustments.`;
      tools = [{
        type: "function",
        function: {
          name: "provide_simulation",
          description: "Return before/after KPI comparison",
          parameters: {
            type: "object",
            properties: {
              baseline: {
                type: "object",
                properties: {
                  utilization_pct: { type: "number" },
                  on_time_rate_pct: { type: "number" },
                  wip_count: { type: "number" },
                  throughput_per_day: { type: "number" }
                },
                required: ["utilization_pct", "on_time_rate_pct", "wip_count", "throughput_per_day"],
                additionalProperties: false
              },
              scenario: {
                type: "object",
                properties: {
                  utilization_pct: { type: "number" },
                  on_time_rate_pct: { type: "number" },
                  wip_count: { type: "number" },
                  throughput_per_day: { type: "number" }
                },
                required: ["utilization_pct", "on_time_rate_pct", "wip_count", "throughput_per_day"],
                additionalProperties: false
              },
              explanation: { type: "string" }
            },
            required: ["baseline", "scenario", "explanation"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "provide_simulation" } };
    } else if (action === "analyze-waste") {
      systemPrompt = `You are a production waste analysis AI. Analyze waste records to identify patterns, top reasons, and provide actionable recommendations to reduce waste. Today is ${today}. Respond in ${lang}.`;
      tools = [{
        type: "function",
        function: {
          name: "provide_waste_analysis",
          description: "Return waste analysis with KPIs and recommendations",
          parameters: {
            type: "object",
            properties: {
              waste_rate_pct: { type: "number", description: "Overall waste rate as percentage of total production" },
              total_waste_qty: { type: "number", description: "Total waste quantity" },
              top_reasons: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    reason: { type: "string" },
                    count: { type: "number" },
                    total_qty: { type: "number" }
                  },
                  required: ["reason", "count", "total_qty"],
                  additionalProperties: false
                }
              },
              waste_by_product: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product: { type: "string" },
                    waste_qty: { type: "number" },
                    waste_pct: { type: "number" }
                  },
                  required: ["product", "waste_qty", "waste_pct"],
                  additionalProperties: false
                }
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    severity: { type: "string", enum: ["critical", "warning", "info"] },
                    title: { type: "string" },
                    description: { type: "string" }
                  },
                  required: ["severity", "title", "description"],
                  additionalProperties: false
                }
              }
            },
            required: ["waste_rate_pct", "total_waste_qty", "top_reasons", "waste_by_product", "recommendations"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "provide_waste_analysis" } };
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the current production data:\n${dataContext}` },
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);

      // Fallback for schedule action
      if (action === "generate-schedule") {
        console.log("AI failed, returning local fallback schedule");
        const activeOrders = orders.filter(o => o.status !== "completed" && o.status !== "cancelled" && !lockedSet.has(o.id));
        activeOrders.sort((a, b) => ((a as any).priority || 3) - ((b as any).priority || 3));
        let cd = new Date(today);
        const suggestions = activeOrders.map(o => {
          const dur = Math.max(Math.ceil((Number(o.quantity) || 1) / 10), 1);
          const s = new Date(cd);
          const e = new Date(s); e.setDate(e.getDate() + dur);
          cd = new Date(e);
          return { order_id: o.id, order_number: o.order_number || o.id.substring(0, 8), suggested_start: s.toISOString().split("T")[0], suggested_end: e.toISOString().split("T")[0], priority: (o as any).priority || 3, explanation: "Fallback schedule" };
        });
        return new Response(JSON.stringify({ suggestions, overall_explanation: "AI unavailable — local fallback schedule generated by priority and due date.", _fallback: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed = JSON.parse(toolCall.function.arguments);

    // Post-processing: validate schedule dates
    if (action === "generate-schedule" && parsed.suggestions) {
      const validSuggestions: any[] = [];
      let invalidCount = 0;
      for (const s of parsed.suggestions) {
        // Skip locked orders
        if (lockedSet.has(s.order_id)) continue;
        // Validate dates
        if (s.suggested_start >= s.suggested_end) { invalidCount++; continue; }
        if (s.suggested_start < today) { invalidCount++; continue; }
        validSuggestions.push(s);
      }
      if (invalidCount > 0) {
        console.warn(`Filtered out ${invalidCount} invalid schedule suggestions`);
        parsed._filtered_count = invalidCount;
      }
      parsed.suggestions = validSuggestions;
    }

    // Audit log
    try {
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await adminClient.from("ai_action_log").insert({
        tenant_id,
        user_id: caller.id,
        action_type: action === "generate-schedule" ? "schedule_generation" : action === "predict-bottlenecks" ? "bottleneck_prediction" : action === "simulate-scenario" ? "capacity_simulation" : action === "analyze-waste" ? "waste_analysis" : "dashboard_analysis",
        module: "production",
        model_version: "gemini-3-flash-preview",
        reasoning: `Production AI: ${action} with ${orders.length} orders`,
      });
    } catch (logErr) {
      console.warn("Failed to log AI action:", logErr);
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("production-ai-planning error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
