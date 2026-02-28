import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Model 97 control digit calculation */
function calcModel97(reference: string): string {
  const digits = reference.replace(/[^0-9]/g, "");
  let remainder = 0;
  for (const d of digits) {
    remainder = (remainder * 10 + parseInt(d)) % 97;
  }
  const ctrl = 98 - remainder;
  return `97 ${String(ctrl).padStart(2, "0")}${digits}`;
}

/** Serbian treasury accounts — consolidated account 840-4848-37 per Pravilnik (Sl. gl. RS 20/2024) */
const TREASURY_ACCOUNTS: Record<string, { account: string; purpose: string; model: string; sifraPlacanja: string }> = {
  pit: { account: "840-4848-37", purpose: "Porez na zarade", model: "97", sifraPlacanja: "254" },
  pio_employee: { account: "840-4848-37", purpose: "PIO zaposleni", model: "97", sifraPlacanja: "254" },
  pio_employer: { account: "840-4848-37", purpose: "PIO poslodavac", model: "97", sifraPlacanja: "254" },
  health_employee: { account: "840-4848-37", purpose: "Zdravstveno zaposleni", model: "97", sifraPlacanja: "254" },
  health_employer: { account: "840-4848-37", purpose: "Zdravstveno poslodavac", model: "97", sifraPlacanja: "254" },
  unemployment: { account: "840-4848-37", purpose: "Nezaposlenost", model: "97", sifraPlacanja: "254" },
  municipal_tax: { account: "840-4848-37", purpose: "Prirez na porez na zarade", model: "97", sifraPlacanja: "254" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // CR-17: Add JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { payroll_run_id, tax_type, amount, period_month, period_year, tenant_id: bodyTenantId } = body;

    // Verify tenant membership
    const tenantIdToCheck = bodyTenantId || (payroll_run_id ? null : null);
    if (tenantIdToCheck) {
      const { data: membership } = await supabase
        .from("tenant_members")
        .select("id")
        .eq("tenant_id", tenantIdToCheck)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Handle standalone tax payment (e.g. PDV)
    if (tax_type && !payroll_run_id) {
      const { data: le } = await supabase
        .from("legal_entities")
        .select("pib, company_name")
        .eq("tenant_id", bodyTenantId)
        .eq("is_primary", true)
        .maybeSingle();

      const pib = le?.pib || "000000000";
      const periodStr = `${period_year}${String(period_month).padStart(2, "0")}`;
      const reference = calcModel97(pib + periodStr);

      const treasuryMap: Record<string, string> = {
        pdv: "840-742152843-20",
        cit: "840-711211843-83",
      };

      const paymentOrder = {
        senderName: le?.company_name || "",
        recipientAccount: treasuryMap[tax_type] || "840-742152843-20",
        recipientName: "Republika Srbija",
        amount: Number(amount).toFixed(2),
        paymentCode: "253",
        model: "97",
        reference,
        purpose: `Uplata ${tax_type.toUpperCase()} za ${period_month}/${period_year}`,
      };

      return new Response(JSON.stringify({ paymentOrder }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payroll payment orders
    if (!payroll_run_id) throw new Error("payroll_run_id or tax_type required");

    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("id", payroll_run_id)
      .single();
    if (runErr || !run) throw new Error("Payroll run not found");

    // Verify membership for payroll tenant
    const { data: payrollMembership } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", run.tenant_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!payrollMembership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await supabase
      .from("payroll_items")
      .select("*, employees(full_name, jmbg, bank_account_iban, bank_name)")
      .eq("payroll_run_id", payroll_run_id)
      .order("created_at");

    const { data: bankAccount } = await supabase
      .from("bank_accounts")
      .select("account_number, bank_name, iban")
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

    const periodStr = `${run.period_year}${String(run.period_month).padStart(2, "0")}`;
    const senderAccount = bankAccount?.account_number || bankAccount?.iban || "";
    const senderName = legalEntity?.company_name || "";
    const pib = legalEntity?.pib || "000000000";

    // CSV header
    const header = "RedniBroj,RacunPlatioca,NazivPlatioca,RacunPrimaoca,NazivPrimaoca,Iznos,SifraPlacanja,Model,PozivNaBrojZaduzenje,PozivNaBrojOdobrenje,Svrha";
    const rows: string[] = [];
    let idx = 1;

    // 1. Net salary payments to employees
    for (const item of items || []) {
      const emp = item.employees;
      const iban = emp?.bank_account_iban || "";
      const name = emp?.full_name || "";
      const jmbg = emp?.jmbg || "0000000000000";
      const net = Number(item.net_salary).toFixed(2);
      const pozivOdobrenje = calcModel97(jmbg + periodStr);
      const svrha = `Isplata zarade za ${run.period_month}/${run.period_year}`;

      rows.push(`${idx},"${senderAccount}","${senderName}","${iban}","${name}",${net},240,97,,${pozivOdobrenje},"${svrha}"`);
      idx++;
    }

    // 2. Tax & contribution payments to treasury
    const totals: Record<string, number> = {
      pit: 0,
      pio_employee: 0,
      pio_employer: 0,
      health_employee: 0,
      health_employer: 0,
      unemployment: 0,
      municipal_tax: 0,
    };

    for (const item of items || []) {
      totals.pit += Number(item.tax_amount || item.income_tax || 0);
      totals.pio_employee += Number(item.pio_employee || item.pension_contribution || 0);
      totals.pio_employer += Number(item.pio_employer || 0);
      totals.health_employee += Number(item.health_employee || item.health_contribution || 0);
      totals.health_employer += Number(item.health_employer || 0);
      totals.unemployment += Number(item.unemployment_employee || item.unemployment_contribution || 0)
        + Number(item.unemployment_employer || 0);
      totals.municipal_tax += Number(item.municipal_tax || 0);
    }

    const reference = calcModel97(pib + periodStr);

    for (const [key, info] of Object.entries(TREASURY_ACCOUNTS)) {
      const amt = totals[key] || 0;
      if (amt <= 0) continue;
      rows.push(`${idx},"${senderAccount}","${senderName}","${info.account}","Uprava za trezor",${amt.toFixed(2)},${info.sifraPlacanja},${info.model},,${reference},"${info.purpose} ${run.period_month}/${run.period_year}"`);
      idx++;
    }

    const csv = header + "\n" + rows.join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="NaloziZaPlacanje_${periodStr}.csv"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
