import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

/**
 * Recurring Journal Entry Generator
 * Triggered by cron schedule or manual invocation.
 * Processes all active recurring_journals where next_run_date <= today.
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];

    const { data: templates, error: fetchErr } = await supabase
      .from("recurring_journals")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (fetchErr) throw fetchErr;
    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No journal templates due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;
    const errors: string[] = [];

    for (const tpl of templates) {
      try {
        // Generate journal entry number
        const { count } = await supabase
          .from("journal_entries")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tpl.tenant_id);
        const seq = (count ?? 0) + 1;
        const entryNumber = `RJ-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;

        // Create journal entry from template
        const { data: je, error: insertErr } = await supabase.from("journal_entries").insert({
          tenant_id: tpl.tenant_id,
          entry_number: entryNumber,
          entry_date: today,
          description: tpl.description || `Auto: ${tpl.template_name}`,
          legal_entity_id: tpl.legal_entity_id || null,
          status: tpl.auto_post ? "posted" : "draft",
          source: "recurring",
        }).select("id").single();
        if (insertErr) throw insertErr;

        // Copy template lines if they exist (recurring_journal_lines)
        const { data: tplLines } = await supabase
          .from("recurring_journal_lines")
          .select("*")
          .eq("recurring_journal_id", tpl.id)
          .order("sort_order");

        if (tplLines && tplLines.length > 0 && je) {
          const journalLines = tplLines.map((l: any) => ({
            tenant_id: tpl.tenant_id,
            journal_entry_id: je.id,
            account_id: l.account_id,
            debit: l.debit || 0,
            credit: l.credit || 0,
            description: l.description || "",
            sort_order: l.sort_order || 0,
          }));
          const { error: linesErr } = await supabase.from("journal_lines").insert(journalLines);
          if (linesErr) console.error("Failed to insert journal lines:", linesErr);
        }

        // Advance next_run_date
        const nextDate = computeNextDate(tpl.next_run_date, tpl.frequency);
        const isExpired = tpl.end_date && nextDate > tpl.end_date;

        await supabase.from("recurring_journals").update({
          next_run_date: nextDate,
          last_run_date: today,
          is_active: !isExpired,
        }).eq("id", tpl.id);

        generated++;
      } catch (e: any) {
        errors.push(`Template ${tpl.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ generated, total: templates.length, errors }), {
      headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    });
  } catch (error: any) {
    return createErrorResponse(error, req, { logPrefix: "recurring-journal-generate" });
  }
});

function computeNextDate(currentDate: string, frequency: string): string {
  const d = new Date(currentDate);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "semi_annual": d.setMonth(d.getMonth() + 6); break;
    case "annual": d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split("T")[0];
}
