import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }
    const callerId = claimsData.claims.sub;
    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: callerId });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { data: tenant, error: tErr } = await supabase.from("tenants").select("id, name").eq("id", tenant_id).single();
    if (tErr || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 404, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const log: string[] = [];
    const counts: Record<string, number> = {};
    const t = tenant_id;

    // 1. Force-delete journal entries
    const { error: rpcErr } = await supabase.rpc("force_delete_journal_entries", { p_tenant_id: t });
    if (rpcErr) log.push(`⚠ force_delete_journal_entries: ${rpcErr.message}`); else log.push("✓ Journal entries force-deleted");

    // 2. FK cleanup
    const fkCleanup = [
      { parent: "invoices", child: "invoice_lines", fk: "invoice_id" },
      { parent: "invoices", child: "credit_notes", fk: "invoice_id" },
      { parent: "invoices", child: "deferrals", fk: "source_invoice_id" },
      { parent: "quotes", child: "quote_lines", fk: "quote_id" },
      { parent: "sales_orders", child: "sales_order_lines", fk: "sales_order_id" },
      { parent: "purchase_orders", child: "purchase_order_lines", fk: "purchase_order_id" },
      { parent: "purchase_orders", child: "supplier_invoices", fk: "purchase_order_id" },
      { parent: "goods_receipts", child: "goods_receipt_lines", fk: "goods_receipt_id" },
      { parent: "bank_statements", child: "bank_statement_lines", fk: "statement_id" },
      { parent: "bom_templates", child: "bom_lines", fk: "bom_template_id" },
      { parent: "bom_templates", child: "production_orders", fk: "bom_template_id" },
      { parent: "payroll_runs", child: "payroll_items", fk: "payroll_run_id" },
      { parent: "production_orders", child: "production_consumption", fk: "production_order_id" },
      { parent: "open_items", child: "open_item_payments", fk: "open_item_id" },
      { parent: "leads", child: "opportunities", fk: "lead_id" },
      { parent: "companies", child: "activities", fk: "company_id" },
      { parent: "contacts", child: "opportunities", fk: "contact_id" },
      { parent: "salespeople", child: "opportunities", fk: "salesperson_id" },
      { parent: "warehouses", child: "inventory_cost_layers", fk: "warehouse_id" },
      { parent: "products", child: "inventory_cost_layers", fk: "product_id" },
      { parent: "products", child: "retail_prices", fk: "product_id" },
      { parent: "wms_zones", child: "wms_bins", fk: "zone_id" },
      { parent: "wms_bins", child: "wms_bin_stock", fk: "bin_id" },
      { parent: "wms_bins", child: "wms_tasks", fk: "from_bin_id" },
      { parent: "employees", child: "salespeople", fk: "employee_id" },
      { parent: "partners", child: "open_items", fk: "partner_id" },
      { parent: "partners", child: "return_cases", fk: "partner_id" },
      { parent: "production_orders", child: "quality_checks", fk: "production_order_id" },
      { parent: "quality_checks", child: "quality_check_items", fk: "quality_check_id" },
      { parent: "wms_returns", child: "wms_return_lines", fk: "return_id" },
    ];

    for (const { parent, child, fk } of fkCleanup) {
      try {
        const { data: parentIds } = await supabase.from(parent).select("id").eq("tenant_id", t);
        if (parentIds && parentIds.length > 0) {
          const ids = parentIds.map((r: any) => r.id);
          let deleted = 0;
          for (let i = 0; i < ids.length; i += 100) {
            const { count } = await supabase.from(child).delete({ count: "exact" }).in(fk, ids.slice(i, i + 100));
            deleted += count || 0;
          }
          if (deleted > 0) counts[child] = (counts[child] || 0) + deleted;
        }
      } catch (e) { log.push(`⚠ FK cleanup ${parent}->${child}: ${e.message}`); }
    }

    // 3. Delete transactional tables
    const cleanupTables = [
      "ai_action_log", "ai_anomaly_baselines", "ai_conversations", "ai_insights_cache", "ai_narrative_cache", "ai_rate_limits", "ai_token_usage",
      "notifications", "notification_preferences", "native_push_tokens", "audit_log", "archiving_request_items", "archiving_requests", "archive_book",
      "approval_steps", "approval_requests", "approval_workflows", "document_versions", "documents", "document_categories", "dms_project_members", "dms_projects",
      "pos_daily_reports", "pos_transactions", "pos_sessions", "pdv_entries", "pdv_periods", "payroll_runs", "night_work_records",
      "attendance_records", "leave_requests", "overtime_hours", "insurance_records", "allowances", "allowance_types", "deductions",
      "open_item_payments", "open_items", "credit_notes", "return_cases", "deferrals", "deferral_schedules", "advance_payments", "bad_debt_provisions",
      "bank_reconciliation_lines", "bank_reconciliations", "inventory_cost_layers", "wms_labor_log", "wms_return_lines", "wms_returns",
      "wms_tasks", "wms_cycle_counts", "wms_bin_stock", "quality_check_items", "quality_checks", "production_maintenance", "production_consumption", "production_orders",
      "crm_tasks", "activities", "opportunities", "sales_targets", "salespeople", "sales_channels", "exchange_rates", "currencies",
      "position_templates", "meetings", "fixed_assets", "work_logs", "annual_leave_balances", "inventory_movements", "bom_lines", "bom_templates",
      "goods_receipt_lines", "goods_receipts", "quote_lines", "quotes", "sales_order_lines", "sales_orders", "purchase_order_lines", "purchase_orders",
      "supplier_invoices", "fiscal_receipts", "invoice_lines", "invoices", "employee_contracts", "employee_salaries", "employees", "inventory_stock",
      "wms_bins", "wms_zones", "warehouses", "contact_company_assignments", "contacts", "company_category_assignments", "companies", "company_categories",
      "leads", "loans", "partners", "products", "fiscal_devices", "fiscal_periods", "departments", "locations", "budgets", "cost_centers",
      "bank_statement_lines", "bank_statements", "bank_accounts", "ar_aging_snapshots", "ap_aging_snapshots", "sef_invoices", "kalkulacija_lines", "kalkulacije",
      "nivelacija_lines", "nivelacije", "internal_goods_receipt_items", "internal_goods_receipts", "internal_transfer_items", "internal_transfers",
      "discount_approval_rules", "opportunity_stages", "web_prices", "posting_rules", "module_events", "business_rules", "retail_prices",
    ];

    for (const table of cleanupTables) {
      try {
        const { count, error } = await supabase.from(table).delete({ count: "exact" }).eq("tenant_id", t);
        if (error) { if (!error.message.includes("does not exist")) log.push(`⚠ ${table}: ${error.message}`); }
        else if (count && count > 0) counts[table] = count;
      } catch (e) { log.push(`⚠ ${table}: ${e.message}`); }
    }

    const totalDeleted = Object.values(counts).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({
        success: true, tenant: tenant.name, tenant_id: t, total_rows_deleted: totalDeleted, counts, log,
        preserved: ["tenants", "tenant_members", "legal_entities", "chart_of_accounts", "tax_rates", "tenant_settings", "user_roles", "profiles"],
      }),
      { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) }
    );
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "clear-tenant-data" });
  }
});
