/**
 * BC-02: Tenant Data Export Edge Function
 * ISO 22301 — Business Continuity: exports all tenant data as JSON for portability.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

const EXPORT_TABLES = [
  "partners", "invoices", "invoice_lines", "products", "chart_of_accounts",
  "journal_entries", "journal_entry_lines", "employees", "contacts", "companies",
  "leads", "opportunities", "bank_accounts", "bank_statements", "bank_statement_lines",
  "archive_book", "legal_entities", "cost_centers", "warehouses",
];

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const { data: membership } = await sb.from("tenant_users").select("tenant_id, role").eq("user_id", user.id).limit(1).single();
    if (!membership) {
      return new Response(JSON.stringify({ error: "No tenant membership" }), {
        status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    if (!["admin", "owner", "super_admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const tenantId = membership.tenant_id;
    const exportData: Record<string, unknown[]> = {};

    for (const table of EXPORT_TABLES) {
      try {
        const { data, error } = await sb.from(table).select("*").eq("tenant_id", tenantId).limit(10000);
        exportData[table] = error ? [] : (data || []);
      } catch { exportData[table] = []; }
    }

    const exportPayload = {
      export_version: "1.0", exported_at: new Date().toISOString(), tenant_id: tenantId,
      exported_by: user.id, tables: exportData,
      row_counts: Object.fromEntries(Object.entries(exportData).map(([k, v]) => [k, v.length])),
    };

    return new Response(JSON.stringify(exportPayload), {
      headers: withSecurityHeaders({
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="tenant-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.json"`,
      }),
    });
  } catch (e) {
    return createErrorResponse(e, req, { logPrefix: "tenant-data-export" });
  }
});
