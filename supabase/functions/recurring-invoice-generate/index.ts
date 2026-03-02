import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

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
        const { count } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tpl.tenant_id);
        const seq = (count ?? 0) + 1;
        const invoiceNumber = `REC-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;

        // Parse template lines
        let lines: any[] = [];
        if (tpl.lines) {
          try {
            lines = typeof tpl.lines === "string" ? JSON.parse(tpl.lines) : tpl.lines;
            if (!Array.isArray(lines)) lines = [];
          } catch { lines = []; }
        }

        // Calculate totals from lines
        let subtotal = 0;
        let taxAmount = 0;
        for (const line of lines) {
          const qty = Number(line.quantity) || 0;
          const price = Number(line.unit_price) || 0;
          const lineTotal = qty * price;
          const rate = Number(line.tax_rate) || 0;
          subtotal += lineTotal;
          taxAmount += lineTotal * (rate / 100);
        }
        const total = subtotal + taxAmount;

        // Create invoice header
        const { data: invoice, error: insertErr } = await supabase.from("invoices").insert({
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
          subtotal,
          tax_amount: taxAmount,
          total,
        }).select("id").single();
        if (insertErr) throw insertErr;

        // Insert invoice lines
        if (lines.length > 0 && invoice) {
          const invoiceLines = lines.map((line: any, idx: number) => {
            const qty = Number(line.quantity) || 0;
            const price = Number(line.unit_price) || 0;
            const lineTotal = qty * price;
            const rate = Number(line.tax_rate) || 0;
            const lineTax = lineTotal * (rate / 100);
            return {
              invoice_id: invoice.id,
              description: line.description || "",
              quantity: qty,
              unit_price: price,
              tax_rate_value: rate,
              line_total: lineTotal,
              tax_amount: lineTax,
              total_with_tax: lineTotal + lineTax,
              sort_order: idx + 1,
            };
          });
          const { error: linesErr } = await supabase.from("invoice_lines").insert(invoiceLines);
          if (linesErr) console.error("Failed to insert invoice lines:", linesErr);
        }

        // Advance next_run_date
        const nextDate = computeNextDate(tpl.next_run_date, tpl.frequency);
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
      headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    });
  } catch (error: any) {
    return createErrorResponse(error, req, { logPrefix: "recurring-invoice-generate" });
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
