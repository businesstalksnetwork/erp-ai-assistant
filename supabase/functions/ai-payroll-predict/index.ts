import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

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
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    // Fetch active employees with salaries
    const { data: employees } = await admin.from("employees")
      .select("id, first_name, last_name, status, hire_date, contract_end_date, department_id")
      .eq("tenant_id", tenant_id).eq("status", "active");

    // Fetch salary data
    const employeeIds = (employees || []).map((e: any) => e.id);
    const { data: salaries } = employeeIds.length > 0
      ? await admin.from("employee_salaries").select("employee_id, gross_salary, net_salary, effective_from")
          .eq("tenant_id", tenant_id).in("employee_id", employeeIds).order("effective_from", { ascending: false })
      : { data: [] };

    // Build salary map (latest per employee)
    const salaryMap: Record<string, { gross: number; net: number }> = {};
    for (const s of (salaries || [])) {
      if (!salaryMap[s.employee_id]) {
        salaryMap[s.employee_id] = { gross: Number(s.gross_salary), net: Number(s.net_salary) };
      }
    }

    // Fetch last 6 months of payroll runs
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1).toISOString().split("T")[0];
    const { data: payrollRuns } = await admin.from("payroll_runs")
      .select("id, month, year, total_gross, total_net, status")
      .eq("tenant_id", tenant_id).gte("created_at", sixMonthsAgo).order("year", { ascending: true }).order("month", { ascending: true });

    // Categorize employees
    const continuing: any[] = [];
    const newHires: any[] = [];
    const departures: any[] = [];

    for (const emp of (employees || [])) {
      const salary = salaryMap[emp.id] || { gross: 0, net: 0 };
      const entry = { id: emp.id, name: `${emp.first_name} ${emp.last_name}`, gross: salary.gross, net: salary.net };

      // New hire if hired within last 30 days or start date is next month
      const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
      const isNewHire = hireDate && hireDate >= new Date(today.getFullYear(), today.getMonth(), 1);

      // Departure if contract ends before next month end
      const endDate = emp.contract_end_date ? new Date(emp.contract_end_date) : null;
      const isDeparting = endDate && endDate <= nextMonthEnd;

      if (isDeparting) departures.push(entry);
      else if (isNewHire) newHires.push(entry);
      else continuing.push(entry);
    }

    const projectedGross = continuing.reduce((s, e) => s + e.gross, 0) + newHires.reduce((s, e) => s + e.gross, 0);
    const projectedNet = continuing.reduce((s, e) => s + e.net, 0) + newHires.reduce((s, e) => s + e.net, 0);
    const departuresSavings = departures.reduce((s, e) => s + e.gross, 0);

    // Last month comparison
    const lastRun = (payrollRuns || []).filter((r: any) => r.status === "finalized" || r.status === "paid").pop();
    const lastGross = lastRun ? Number(lastRun.total_gross) : 0;
    const deltaGross = projectedGross - lastGross;

    // History for trend chart
    const history = (payrollRuns || []).filter((r: any) => r.status === "finalized" || r.status === "paid").map((r: any) => ({
      month: r.month, year: r.year,
      gross: Number(r.total_gross), net: Number(r.total_net),
      label: `${r.year}-${String(r.month).padStart(2, "0")}`,
    }));

    // AI narrative
    let aiNarrative = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const context = {
          projected_gross: projectedGross, projected_net: projectedNet,
          last_month_gross: lastGross, delta: deltaGross,
          continuing_count: continuing.length, new_hires_count: newHires.length,
          departures_count: departures.length, departures_savings: departuresSavings,
          new_hire_cost: newHires.reduce((s, e) => s + e.gross, 0),
        };
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are an HR budget analyst AI. Given payroll projection data, provide a 3-4 sentence budget impact narrative. Highlight key changes (new hires, departures), percentage change from last month, and budget recommendations." },
              { role: "user", content: JSON.stringify(context) },
            ],
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiNarrative = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) { console.error("AI enrichment failed:", e); }
    }

    await admin.from("ai_action_log").insert({
      tenant_id, module: "hr", action_type: "payroll_prediction",
      ai_output: { projected_gross: projectedGross, delta: deltaGross, headcount: (employees || []).length },
      model_version: "google/gemini-3-flash-preview", user_id: userId,
    });

    return new Response(JSON.stringify({
      projected_gross: projectedGross, projected_net: projectedNet,
      last_month_gross: lastGross, delta_gross: deltaGross,
      continuing, new_hires: newHires, departures,
      history, forecast_month: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`,
      narrative: aiNarrative,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-payroll-predict error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
