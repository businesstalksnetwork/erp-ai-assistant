import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // V3.3: Require super_admin auth — this function deletes ALL tenant data
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;
    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: callerId });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tenant exists
    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", tenant_id)
      .single();
    if (tErr || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const log: string[] = [];
    const counts: Record<string, number> = {};
    const t = tenant_id;

    // ═══════════════════════════════════════════════════
    // 1. Force-delete journal entries (disables triggers)
    // ═══════════════════════════════════════════════════
    const { error: rpcErr } = await supabase.rpc("force_delete_journal_entries", { p_tenant_id: t });
    if (rpcErr) log.push(`⚠ force_delete_journal_entries: ${rpcErr.message}`);
    else log.push("✓ Journal entries force-deleted");

    // ═══════════════════════════════════════════════════
    // 2. FK-aware child cleanup (delete children before parents)
    // ═══════════════════════════════════════════════════
    const fkCleanup: Array<{ parent: string; child: string; fk: string }> = [
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
      // New tables from recent migrations
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
            const { count } = await supabase
              .from(child)
              .delete({ count: "exact" })
              .in(fk, ids.slice(i, i + 100));
            deleted += count || 0;
          }
          if (deleted > 0) counts[child] = (counts[child] || 0) + deleted;
        }
      } catch (e) {
        log.push(`⚠ FK cleanup ${parent}->${child}: ${e.message}`);
      }
    }

    // ═══════════════════════════════════════════════════
    // 3. Delete all transactional tables by tenant_id
    // ═══════════════════════════════════════════════════
    const cleanupTables = [
      // AI/cache tables
      "ai_action_log", "ai_anomaly_baselines", "ai_conversations",
      "ai_insights_cache", "ai_narrative_cache", "ai_rate_limits", "ai_token_usage",
      // Notifications
      "notifications", "notification_preferences", "native_push_tokens",
      // Audit
      "audit_log",
      // Archiving
      "archiving_request_items", "archiving_requests", "archive_book",
      // Approvals
      "approval_steps",
      "approval_requests", "approval_workflows",
      // Documents
      "document_versions", "documents", "document_categories",
      "dms_project_members", "dms_projects",
      // POS
      "pos_daily_reports", "pos_transactions", "pos_sessions",
      // PDV
      "pdv_entries", "pdv_periods",
      // Payroll
      "payroll_runs",
      "night_work_records",
      // HR
      "attendance_records", "leave_requests",
      "overtime_hours", "insurance_records",
      "allowances", "allowance_types",
      "deductions",
      // Financial
      "open_item_payments", "open_items",
      "credit_notes", "return_cases",
      "deferrals", "deferral_schedules",
      "advance_payments",
      "bad_debt_provisions",
      "bank_reconciliation_lines", "bank_reconciliations",
      // Inventory
      "inventory_cost_layers",
      // WMS
      "wms_labor_log", "wms_return_lines", "wms_returns",
      "wms_tasks", "wms_cycle_counts", "wms_bin_stock",
      // Production
      "quality_check_items", "quality_checks",
      "production_maintenance",
      "production_consumption", "production_orders",
      // CRM
      "crm_tasks", "activities", "opportunities",
      "sales_targets", "salespeople", "sales_channels",
      // Finance misc
      "exchange_rates", "currencies",
      // HR misc
      "position_templates", "meetings",
      "fixed_assets",
      "work_logs", "annual_leave_balances",
      // Inventory/stock
      "inventory_movements",
      // BOM
      "bom_lines", "bom_templates",
      // Receipts
      "goods_receipt_lines", "goods_receipts",
      // Orders
      "quote_lines", "quotes",
      "sales_order_lines", "sales_orders",
      "purchase_order_lines", "purchase_orders",
      // Invoices
      "supplier_invoices", "fiscal_receipts",
      "invoice_lines", "invoices",
      // Employees
      "employee_contracts", "employee_salaries", "employees",
      // Stock
      "inventory_stock",
      // Warehouses
      "wms_bins", "wms_zones", "warehouses",
      // Contacts/Companies
      "contact_company_assignments", "contacts",
      "company_category_assignments", "companies", "company_categories",
      // Leads
      "leads",
      // Finance
      "loans",
      // Partners/Products
      "partners", "products",
      // Devices/Periods
      "fiscal_devices", "fiscal_periods",
      // Org
      "departments", "locations",
      // Budgets
      "budgets", "cost_centers",
      // Bank
      "bank_statement_lines", "bank_statements", "bank_accounts",
      // Aging
      "ar_aging_snapshots", "ap_aging_snapshots",
      // SEF
      "sef_invoices",
      // Kalkulacije
      "kalkulacija_lines", "kalkulacije",
      // Nivelacije
      "nivelacija_lines", "nivelacije",
      // Internal transfers
      "internal_goods_receipt_items", "internal_goods_receipts",
      "internal_transfer_items", "internal_transfers",
      // Discount rules
      "discount_approval_rules",
      // CRM stages
      "opportunity_stages",
      // Web prices
      "web_prices",
      // Posting rules
      "posting_rules",
      // Module events
      "module_events",
      // Business rules
      "business_rules",
      // Retail prices
      "retail_prices",
    ];

    for (const table of cleanupTables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .eq("tenant_id", t);
        if (error) {
          // Some tables may not exist or have different structure
          if (!error.message.includes("does not exist")) {
            log.push(`⚠ ${table}: ${error.message}`);
          }
        } else if (count && count > 0) {
          counts[table] = count;
        }
      } catch (e) {
        log.push(`⚠ ${table}: ${e.message}`);
      }
    }

    log.push("✓ Cleanup complete");

    const totalDeleted = Object.values(counts).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({
        success: true,
        tenant: tenant.name,
        tenant_id: t,
        total_rows_deleted: totalDeleted,
        counts,
        log,
        preserved: [
          "tenants",
          "tenant_members",
          "legal_entities",
          "chart_of_accounts",
          "tax_rates",
          "tenant_settings",
          "user_roles",
          "profiles",
        ],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
