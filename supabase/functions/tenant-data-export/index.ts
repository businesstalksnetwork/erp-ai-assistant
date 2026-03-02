/**
 * BC-02: Tenant Data Export Edge Function
 * ISO 22301 — Business Continuity: exports all tenant data as JSON for portability.
 * CR8-08: Supports cursor-based pagination to handle large datasets.
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

const PAGE_SIZE = 1000;

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

    // CR11-09: Accept optional tenant_id from request body
    let requestedTenantId: string | null = null;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        requestedTenantId = body.tenant_id || null;
      } else {
        const url = new URL(req.url);
        requestedTenantId = url.searchParams.get("tenant_id");
      }
    } catch { /* ignore */ }

    let membershipQuery = sb.from("tenant_members").select("tenant_id, role").eq("user_id", user.id).eq("status", "active");
    if (requestedTenantId) {
      membershipQuery = membershipQuery.eq("tenant_id", requestedTenantId);
    }
    const { data: membership } = await membershipQuery.limit(1).single();
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

    // Parse cursor from request body or URL
    let cursors: Record<string, string> = {};
    try {
      const url = new URL(req.url);
      const cursorParam = url.searchParams.get("cursor");
      if (cursorParam) {
        cursors = JSON.parse(atob(cursorParam));
      } else if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body.cursor) cursors = body.cursor;
      }
    } catch { /* no cursor = start from beginning */ }

    const exportData: Record<string, unknown[]> = {};
    const nextCursors: Record<string, string> = {};
    let truncated = false;

    for (const table of EXPORT_TABLES) {
      try {
        let query = sb.from(table).select("*").eq("tenant_id", tenantId).order("id").limit(PAGE_SIZE);

        // Apply cursor if we have one for this table
        if (cursors[table]) {
          query = query.gt("id", cursors[table]);
        }

        const { data, error } = await query;
        const rows = error ? [] : (data || []);
        exportData[table] = rows;

        // If we got exactly PAGE_SIZE rows, there may be more
        if (rows.length === PAGE_SIZE) {
          const lastRow = rows[rows.length - 1] as any;
          if (lastRow?.id) {
            nextCursors[table] = lastRow.id;
            truncated = true;
          }
        }
      } catch {
        exportData[table] = [];
      }
    }

    const exportPayload: Record<string, unknown> = {
      export_version: "1.1",
      exported_at: new Date().toISOString(),
      tenant_id: tenantId,
      exported_by: user.id,
      tables: exportData,
      row_counts: Object.fromEntries(Object.entries(exportData).map(([k, v]) => [k, v.length])),
      page_size: PAGE_SIZE,
    };

    if (truncated) {
      exportPayload.truncated = true;
      exportPayload.next_cursor = btoa(JSON.stringify(nextCursors));
    }

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
