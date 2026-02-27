import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Recurring Invoice Generator
 * Triggered by cron schedule or manual invocation.
 * Processes all active recurring_invoices where next_run_date <= today.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];

    // Fetch all active templates due today or earlier
    const { data: templates, error: fetchErr } = await supabase
      .from("recurring_invoices")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (fetchErr) throw fetchErr;
    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No templates due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;
    const errors: string[] = [];

    for (const tpl of templates) {
      try {
        // Generate invoice number
        const { count } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tpl.tenant_id);
        const seq = (count ?? 0) + 1;
        const invoiceNumber = `REC-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;

        // Create invoice from template
        const { error: insertErr } = await supabase.from("invoices").insert({
          tenant_id: tpl.tenant_id,
          invoice_number: invoiceNumber,
          partner_id: tpl.partner_id || null,
          legal_entity_id: tpl.legal_entity_id || null,
          issue_date: today,
          due_date: addDays(today, 15),
          vat_date: today,
          currency: tpl.currency || "RSD",
          status: tpl.auto_post ? "sent" : "draft",
          notes: `Auto-generated from template: ${tpl.template_name}`,
          subtotal: 0,
          tax_amount: 0,
          total: 0,
        });
        if (insertErr) throw insertErr;

        // Advance next_run_date
        const nextDate = computeNextDate(tpl.next_run_date, tpl.frequency);

        // Check if template should be deactivated (past end_date)
        const isExpired = tpl.end_date && nextDate > tpl.end_date;

        await supabase.from("recurring_invoices").update({
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

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
