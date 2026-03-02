import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

interface Alert {
  title: string;
  message: string;
  type: string;
  severity: "info" | "warning" | "critical";
  module: string;
  target_roles: string[];
}

async function checkTenantAlerts(supabase: any, tenantId: string, language: string): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const sr = language === "sr";
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Invoices becoming overdue today
    const { data: newlyOverdue, count: overdueCount } = await supabase
      .from("invoices")
      .select("invoice_number, partner_name, total", { count: "exact" })
      .eq("tenant_id", tenantId)
      .in("status", ["draft", "sent"])
      .eq("due_date", today);

    if (overdueCount && overdueCount > 0) {
      const total = (newlyOverdue || []).reduce((s: number, i: any) => s + Number(i.total), 0);
      alerts.push({
        title: sr ? `${overdueCount} faktura dospeva danas` : `${overdueCount} invoices due today`,
        message: sr
          ? `${overdueCount} faktura u ukupnom iznosu od ${total.toLocaleString("sr-RS")} RSD dospeva danas za plaćanje.`
          : `${overdueCount} invoices totaling ${total.toLocaleString("en-US")} RSD are due today.`,
        type: "overdue_invoice_alert",
        severity: overdueCount > 3 ? "critical" : "warning",
        module: "accounting",
        target_roles: ["admin", "manager", "accountant"],
      });
    }

    // 2. Critical stock (zero or negative)
    const { count: criticalStockCount } = await supabase
      .from("inventory_stock")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .lte("quantity_on_hand", 0)
      .gt("min_stock_level", 0);

    if (criticalStockCount && criticalStockCount > 0) {
      alerts.push({
        title: sr ? `${criticalStockCount} artikala bez zaliha` : `${criticalStockCount} items out of stock`,
        message: sr
          ? `${criticalStockCount} artikala sa definisanim minimalnim nivoom ima nulte ili negativne zalihe.`
          : `${criticalStockCount} items with defined minimum levels have zero or negative stock.`,
        type: "critical_stock_alert",
        severity: "critical",
        module: "inventory",
        target_roles: ["admin", "manager"],
      });
    }

    // 3. Payroll not processed
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const dayOfMonth = new Date().getDate();

    if (dayOfMonth >= 25) {
      const { count: payrollCount } = await supabase
        .from("payroll_runs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("period_month", currentMonth)
        .eq("period_year", currentYear);

      if (!payrollCount || payrollCount === 0) {
        alerts.push({
          title: sr ? "Plate nisu obrađene" : "Payroll not processed",
          message: sr
            ? `Obračun plata za ${currentMonth}/${currentYear} još nije kreiran. Rok se približava.`
            : `Payroll for ${currentMonth}/${currentYear} has not been created yet. Deadline approaching.`,
          type: "payroll_missing_alert",
          severity: "warning",
          module: "hr",
          target_roles: ["admin", "hr", "accountant"],
        });
      }
    }

    // 4. Employee contracts expiring in 30 days
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const { data: expiringContracts, count: expiringCount } = await supabase
      .from("employee_contracts")
      .select("employee_id, end_date", { count: "exact" })
      .eq("tenant_id", tenantId)
      .lte("end_date", futureDate)
      .gte("end_date", today);

    if (expiringCount && expiringCount > 0) {
      alerts.push({
        title: sr ? `${expiringCount} ugovora ističe uskoro` : `${expiringCount} contracts expiring soon`,
        message: sr
          ? `${expiringCount} ugovora o radu ističe u narednih 30 dana.`
          : `${expiringCount} employee contracts expire within the next 30 days.`,
      type: "contract_expiry_alert",
        severity: "warning",
        module: "hr",
        target_roles: ["admin", "hr"],
      });
    }

    // 6. Budget overruns (>90%)
    const { data: budgets } = await supabase
      .from("budgets")
      .select("name, planned_amount, actual_amount")
      .eq("tenant_id", tenantId)
      .gt("planned_amount", 0);

    if (budgets) {
      const overruns = budgets.filter((b: any) => b.actual_amount / b.planned_amount > 0.9);
      if (overruns.length > 0) {
        const critical = overruns.filter((b: any) => b.actual_amount / b.planned_amount > 1.0);
        alerts.push({
          title: sr ? `${overruns.length} budžeta prekoračeno >90%` : `${overruns.length} budgets over 90%`,
          message: sr
            ? `${overruns.length} budžeta je iskorišćeno više od 90%. ${critical.length} ih je prekoračeno.`
            : `${overruns.length} budgets are over 90% utilized. ${critical.length} are exceeded.`,
          type: "budget_overrun_alert",
          severity: critical.length > 0 ? "critical" : "warning",
          module: "accounting",
          target_roles: ["admin", "manager", "accountant"],
        });
      }
    }

    // 7. Lease contracts expiring in 60 days
    const sixtyDays = new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0];
    const { count: leaseCount } = await supabase
      .from("lease_contracts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .lte("end_date", sixtyDays)
      .gte("end_date", today)
      .in("status", ["active", "signed"]);

    if (leaseCount && leaseCount > 0) {
      alerts.push({
        title: sr ? `${leaseCount} ugovora o zakupu ističe` : `${leaseCount} lease contracts expiring`,
        message: sr
          ? `${leaseCount} ugovora o zakupu ističe u narednih 60 dana.`
          : `${leaseCount} lease contracts expire within the next 60 days.`,
        type: "lease_expiry_alert",
        severity: "warning",
        module: "assets",
        target_roles: ["admin", "manager"],
      });
    }

  } catch (e) {
    console.error(`Error checking alerts for tenant ${tenantId}:`, e);
  }

  return alerts;
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // SEC-5: Require either super_admin JWT auth OR CRON_SECRET
    const authHeader = req.headers.get("Authorization");
    let callerUserId: string | null = null;
    let authorized = false;

    // Check CRON_SECRET first
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      authorized = true;
    }

    // If not cron, check JWT for super_admin
    if (!authorized && authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) {
        callerUserId = claimsData.claims.sub;
        // Verify super_admin role
        const { data: superRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", callerUserId)
          .eq("role", "super_admin")
          .maybeSingle();
        if (superRole) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized: requires super_admin or CRON_SECRET" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetTenantId = body.tenant_id;

    // Get tenants to check
    let tenants: Array<{ id: string; name: string }>;
    if (targetTenantId) {
      tenants = [{ id: targetTenantId, name: "" }];
    } else {
      const { data } = await supabase.from("tenants").select("id, name").eq("status", "active");
      tenants = data || [];
    }

    const today = new Date().toISOString().split("T")[0];
    const results: Array<{ tenant_id: string; alerts_created: number }> = [];

    for (const tenant of tenants) {
      const alerts = await checkTenantAlerts(supabase, tenant.id, "sr");

      // Get tenant admin users to notify
      const { data: members } = await supabase
        .from("tenant_members")
        .select("user_id, role")
        .eq("tenant_id", tenant.id)
        .eq("status", "active");

      let createdCount = 0;

      for (const alert of alerts) {
        const targetUsers = (members || []).filter((m: any) =>
          alert.target_roles.includes(m.role)
        );

        for (const user of targetUsers) {
          const { count } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("user_id", user.user_id)
            .eq("type", alert.type)
            .gte("created_at", today + "T00:00:00Z");

          if (!count || count === 0) {
            await supabase.from("notifications").insert({
              tenant_id: tenant.id,
              user_id: user.user_id,
              title: alert.title,
              message: alert.message,
              type: alert.type,
              read: false,
            });
            createdCount++;
          }
        }
      }

      // Log AI action
      if (alerts.length > 0) {
        await supabase.from("ai_action_log").insert({
          tenant_id: tenant.id,
          user_id: callerUserId,
          action_type: "proactive_alert",
          module: "system",
          model_version: "rule-based",
          user_decision: "auto",
          reasoning: `Generated ${alerts.length} alerts, notified ${createdCount} users`,
        });
      }

      results.push({ tenant_id: tenant.id, alerts_created: createdCount });
    }

    return new Response(JSON.stringify({
      success: true,
      tenants_checked: tenants.length,
      results,
      checked_at: new Date().toISOString(),
    }), {
      headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    });

  } catch (e: any) {
    return createErrorResponse(e, req, { logPrefix: "proactive-ai-agent" });
  }
});
