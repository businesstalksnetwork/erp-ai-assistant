import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Serbian Treasury (Uprava za Trezor) recipient accounts for tax payments.
 * Single consolidated account 840-4848-37 with Model 97 reference.
 */
const TAX_ACCOUNTS: Record<string, { name: string; account: string; model: string; sifraPlacanja: string }> = {
  pdv: { name: "PDV - Porez na dodatu vrednost", account: "840-4848-37", model: "97", sifraPlacanja: "253" },
  cit: { name: "Porez na dobit pravnih lica", account: "840-711111843-22", model: "97", sifraPlacanja: "253" },
  cit_advance: { name: "Akontacija poreza na dobit", account: "840-711111843-22", model: "97", sifraPlacanja: "253" },
  pit_salary: { name: "Porez na zarade", account: "840-4848-37", model: "97", sifraPlacanja: "254" },
  pio_employee: { name: "Doprinos za PIO - zaposleni", account: "840-4848-37", model: "97", sifraPlacanja: "254" },
  pio_employer: { name: "Doprinos za PIO - poslodavac", account: "840-4848-37", model: "97", sifraPlacanja: "254" },
  health_employee: { name: "Doprinos za zdravstvo - zaposleni", account: "840-4848-37", model: "97", sifraPlacanja: "254" },
  health_employer: { name: "Doprinos za zdravstvo - poslodavac", account: "840-4848-37", model: "97", sifraPlacanja: "254" },
  unemployment: { name: "Doprinos za nezaposlenost", account: "840-4848-37", model: "97", sifraPlacanja: "254" },
  withholding: { name: "Porez po odbitku", account: "840-4848-37", model: "97", sifraPlacanja: "253" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // MODE 1: Bulk payroll tax orders (payroll_run_id provided)
    if (body.payroll_run_id) {
      return await generatePayrollTaxOrders(admin, body.payroll_run_id, corsHeaders);
    }

    // MODE 2: Single tax payment order (legacy)
    const { tenant_id, tax_type, amount, period_month, period_year, pib } = body;
    if (!tenant_id || !tax_type || !amount || !pib) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taxConfig = TAX_ACCOUNTS[tax_type];
    if (!taxConfig) {
      return new Response(JSON.stringify({ error: `Unknown tax type: ${tax_type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthStr = period_month ? String(period_month).padStart(2, "0") : "00";
    const yearStr = period_year ? String(period_year) : String(new Date().getFullYear());
    const pozivNaBroj = generateModel97Reference(pib, monthStr, yearStr);

    const { data: bankAccount } = await supabase
      .from("bank_accounts").select("account_number, bank_name")
      .eq("tenant_id", tenant_id).eq("is_primary", true).eq("is_active", true).limit(1).single();

    const paymentOrder = {
      platilac: { naziv: "", racun: bankAccount?.account_number || "", banka: bankAccount?.bank_name || "" },
      primalac: { naziv: taxConfig.name, racun: taxConfig.account },
      iznos: Number(amount).toFixed(2),
      valuta: "RSD",
      svrhaPlacanja: `${taxConfig.name} za ${monthStr}/${yearStr}`,
      sifraPlacanja: taxConfig.sifraPlacanja,
      model: taxConfig.model,
      pozivNaBrojOdobrenja: pozivNaBroj,
      datumPlacanja: new Date().toISOString().split("T")[0],
    };

    return new Response(JSON.stringify({ paymentOrder }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Generate bulk CSV of tax/contribution payment orders for a payroll run
 */
async function generatePayrollTaxOrders(
  admin: any, payrollRunId: string, corsHeaders: Record<string, string>
) {
  const { data: run, error: runErr } = await admin
    .from("payroll_runs").select("*").eq("id", payrollRunId).single();
  if (runErr || !run) throw new Error("Payroll run not found");

  const { data: items } = await admin
    .from("payroll_items")
    .select("income_tax, pension_contribution, health_contribution, unemployment_contribution, pension_employer, health_employer, employer_pio, employer_health, municipal_tax, subsidy_amount")
    .eq("payroll_run_id", payrollRunId);

  const { data: legalEntity } = await admin
    .from("legal_entities").select("pib, company_name")
    .eq("tenant_id", run.tenant_id).eq("is_primary", true).maybeSingle();

  const { data: bankAccount } = await admin
    .from("bank_accounts").select("account_number")
    .eq("tenant_id", run.tenant_id).eq("is_primary", true).eq("is_active", true).maybeSingle();

  const pib = legalEntity?.pib || "000000000";
  const senderAccount = bankAccount?.account_number || "";
  const senderName = legalEntity?.company_name || "";
  const monthStr = String(run.period_month).padStart(2, "0");
  const yearStr = String(run.period_year);
  const pozivNaBroj = generateModel97Reference(pib, monthStr, yearStr);
  const periodLabel = `${yearStr}${monthStr}`;

  // Aggregate totals
  const t = (items || []).reduce(
    (acc: any, i: any) => ({
      tax: acc.tax + Number(i.income_tax || 0),
      pioE: acc.pioE + Number(i.pension_contribution || 0),
      pioR: acc.pioR + Number(i.pension_employer || i.employer_pio || 0),
      healthE: acc.healthE + Number(i.health_contribution || 0),
      healthR: acc.healthR + Number(i.health_employer || i.employer_health || 0),
      unemp: acc.unemp + Number(i.unemployment_contribution || 0),
      municipal: acc.municipal + Number(i.municipal_tax || 0),
    }),
    { tax: 0, pioE: 0, pioR: 0, healthE: 0, healthR: 0, unemp: 0, municipal: 0 }
  );

  const header = "RedniBroj,RacunPlatioca,NazivPlatioca,RacunPrimaoca,NazivPrimaoca,Iznos,SifraPlacanja,Model,PozivNaBrojOdobrenje,Svrha";
  const rows: string[] = [];
  let idx = 1;

  const addRow = (taxType: string, amount: number) => {
    if (amount <= 0.01) return;
    const cfg = TAX_ACCOUNTS[taxType];
    if (!cfg) return;
    rows.push(
      `${idx++},${senderAccount},"${senderName}",${cfg.account},"Uprava za trezor",${amount.toFixed(2)},${cfg.sifraPlacanja},${cfg.model},${pozivNaBroj},"${cfg.name} ${run.period_month}/${run.period_year}"`
    );
  };

  addRow("pit_salary", t.tax);
  addRow("pio_employee", t.pioE);
  addRow("pio_employer", t.pioR);
  addRow("health_employee", t.healthE);
  addRow("health_employer", t.healthR);
  addRow("unemployment", t.unemp);

  const csv = header + "\n" + rows.join("\n");
  return new Response(csv, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="NaloziPorezi_${periodLabel}.csv"`,
    },
  });
}

function generateModel97Reference(pib: string, month: string, year: string): string {
  const baseRef = `${pib}${month}${year}`;
  const numericStr = baseRef.replace(/\D/g, "");
  const remainder = mod97(numericStr + "00");
  const controlDigits = String(98 - remainder).padStart(2, "0");
  return `${controlDigits}${numericStr}`;
}

function mod97(str: string): number {
  let remainder = 0;
  for (let i = 0; i < str.length; i++) {
    remainder = (remainder * 10 + parseInt(str[i])) % 97;
  }
  return remainder;
}
