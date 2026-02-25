import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payroll_run_id } = await req.json();
    if (!payroll_run_id) throw new Error("payroll_run_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("id", payroll_run_id)
      .single();
    if (runErr || !run) throw new Error("Payroll run not found");

    const { data: items } = await supabase
      .from("payroll_items")
      .select("*, employees(full_name, jmbg, bank_account_iban, bank_name, recipient_code)")
      .eq("payroll_run_id", payroll_run_id)
      .order("created_at");

    // Fetch employer bank account
    const { data: bankAccount } = await supabase
      .from("bank_accounts")
      .select("account_number, bank_name")
      .eq("tenant_id", run.tenant_id)
      .eq("is_primary", true)
      .eq("is_active", true)
      .maybeSingle();

    const { data: legalEntity } = await supabase
      .from("legal_entities")
      .select("pib, company_name")
      .eq("tenant_id", run.tenant_id)
      .eq("is_primary", true)
      .maybeSingle();

    const periodLabel = `${run.period_year}${String(run.period_month).padStart(2, "0")}`;
    const senderAccount = bankAccount?.account_number || "";
    const senderName = legalEntity?.company_name || "";

    // Generate CSV: Serbian bank payment order format
    const header = "RedniBroj,RacunPlatioca,NazivPlatioca,RacunPrimaoca,NazivPrimaoca,Iznos,SifraPlacanja,PozivNaBrojZaduzenje,PozivNaBrojOdobrenje,Svrha";
    const rows: string[] = [];

    let idx = 1;
    for (const item of items || []) {
      const emp = item.employees;
      const iban = emp?.bank_account_iban || "";
      const name = emp?.full_name || "";
      const jmbg = emp?.jmbg || "0000000000000";
      const net = Number(item.net_salary).toFixed(2);
      // Poziv na broj: model 97 + JMBG + period
      const pozivOdobrenje = `97 ${jmbg}`;
      const svrha = `Isplata zarade za ${run.period_month}/${run.period_year}`;

      rows.push(`${idx},${senderAccount},"${senderName}",${iban},"${name}",${net},240,,${pozivOdobrenje},"${svrha}"`);
      idx++;
    }

    const csv = header + "\n" + rows.join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="NaloziZaPlacanje_${periodLabel}.csv"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
