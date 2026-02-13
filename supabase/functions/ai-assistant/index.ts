import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA_CONTEXT = `You are an AI assistant for an ERP system. You have access to these database tables (all scoped to a specific tenant_id):
- invoices: invoice_number, invoice_date, due_date, partner_name, status (draft/sent/paid/cancelled), subtotal, tax_amount, total, currency
- invoice_lines: invoice_id, description, quantity, unit_price, line_total, tax_amount
- journal_entries: entry_number, entry_date, description, status (draft/posted/reversed), reference
- journal_lines: journal_entry_id, account_id, debit, credit, description
- chart_of_accounts: code, name, name_sr, account_type (asset/liability/equity/revenue/expense)
- partners: name, type (customer/supplier/both), email, phone, pib, city
- products: name, sku, unit_of_measure, purchase_price, sale_price, barcode
- inventory_stock: product_id, warehouse_id, quantity_on_hand, quantity_reserved, min_stock_level
- employees: full_name, position, email, status, department_id
- employee_contracts: employee_id, gross_salary, net_salary, contract_type
- payroll_runs: period_month, period_year, status, total_gross, total_net
- purchase_orders: order_number, supplier_name, status, total
- fixed_assets: name, acquisition_date, acquisition_cost, status, depreciation_method
- leads: name, company, status, source
- opportunities: title, value, probability, stage

When answering questions:
1. Always be helpful and provide specific data when possible
2. Format numbers with 2 decimal places
3. Support both English and Serbian language
4. If a question is ambiguous, provide the most likely interpretation
5. Keep answers concise but informative`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { messages, tenant_id, language } = await req.json();
    
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch contextual data for the tenant
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather quick stats for context
    const [invoiceStats, partnerCount, productCount, employeeCount] = await Promise.all([
      supabase.from("invoices").select("status, total").eq("tenant_id", tenant_id),
      supabase.from("partners").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("status", "active"),
    ]);

    const invoices = invoiceStats.data || [];
    const overdueInvoices = invoices.filter(i => i.status === "sent" || i.status === "draft");
    const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);

    const contextData = `
Current tenant data summary:
- Total invoices: ${invoices.length} (Paid: ${invoices.filter(i => i.status === "paid").length}, Outstanding: ${overdueInvoices.length})
- Total revenue from paid invoices: ${totalRevenue.toFixed(2)} RSD
- Partners: ${partnerCount.count || 0}
- Products: ${productCount.count || 0}
- Active employees: ${employeeCount.count || 0}
- User language preference: ${language || "en"}`;

    const systemPrompt = `${SCHEMA_CONTEXT}\n\n${contextData}\n\nRespond in ${language === "sr" ? "Serbian" : "English"}.`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
