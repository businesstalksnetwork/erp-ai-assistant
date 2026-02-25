import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Serbian Treasury (Uprava za Trezor) recipient accounts for tax payments.
 * Model 97 references with poziv na broj based on PIB.
 */
const TAX_ACCOUNTS: Record<string, { name: string; account: string; model: string; sifraPlacanja: string }> = {
  pdv: {
    name: "PDV - Porez na dodatu vrednost",
    account: "840-4848-37",
    model: "97",
    sifraPlacanja: "253",
  },
  cit: {
    name: "Porez na dobit pravnih lica",
    account: "840-711111843-22",
    model: "97",
    sifraPlacanja: "253",
  },
  cit_advance: {
    name: "Akontacija poreza na dobit",
    account: "840-711111843-22",
    model: "97",
    sifraPlacanja: "253",
  },
  pit_salary: {
    name: "Porez na zarade",
    account: "840-4848-37",
    model: "97",
    sifraPlacanja: "254",
  },
  pio_employee: {
    name: "Doprinos za PIO - zaposleni",
    account: "840-4848-37",
    model: "97",
    sifraPlacanja: "254",
  },
  pio_employer: {
    name: "Doprinos za PIO - poslodavac",
    account: "840-4848-37",
    model: "97",
    sifraPlacanja: "254",
  },
  health_employee: {
    name: "Doprinos za zdravstvo - zaposleni",
    account: "840-4848-37",
    model: "97",
    sifraPlacanja: "254",
  },
  unemployment: {
    name: "Doprinos za nezaposlenost",
    account: "840-4848-37",
    model: "97",
    sifraPlacanja: "254",
  },
  withholding: {
    name: "Porez po odbitku",
    account: "840-4848-37",
    model: "97",
    sifraPlacanja: "253",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, tax_type, amount, period_month, period_year, pib } = await req.json();
    
    if (!tenant_id || !tax_type || !amount || !pib) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taxConfig = TAX_ACCOUNTS[tax_type];
    if (!taxConfig) {
      return new Response(JSON.stringify({ error: `Unknown tax type: ${tax_type}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate poziv na broj (reference number) using Model 97
    // Format: PIB + kontrolni broj + mesec/godina
    const monthStr = period_month ? String(period_month).padStart(2, "0") : "00";
    const yearStr = period_year ? String(period_year) : String(new Date().getFullYear());
    const pozivNaBroj = generateModel97Reference(pib, monthStr, yearStr);

    // Get legal entity bank account
    const { data: bankAccount } = await supabase
      .from("bank_accounts")
      .select("account_number, bank_name")
      .eq("tenant_id", tenant_id)
      .eq("is_primary", true)
      .eq("is_active", true)
      .limit(1)
      .single();

    const paymentOrder = {
      platilac: {
        naziv: "", // will be filled from legal entity
        racun: bankAccount?.account_number || "",
        banka: bankAccount?.bank_name || "",
      },
      primalac: {
        naziv: taxConfig.name,
        racun: taxConfig.account,
      },
      iznos: Number(amount).toFixed(2),
      valuta: "RSD",
      svrhaPlacanja: `${taxConfig.name} za ${monthStr}/${yearStr}`,
      sifraPlacanja: taxConfig.sifraPlacanja,
      model: taxConfig.model,
      pozivNaBrojOdobrenja: pozivNaBroj,
      datumPlacanja: new Date().toISOString().split("T")[0],
    };

    return new Response(JSON.stringify({ paymentOrder }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Generate Model 97 reference number (poziv na broj)
 * Standard Serbian format for tax payments
 */
function generateModel97Reference(pib: string, month: string, year: string): string {
  const baseRef = `${pib}${month}${year}`;
  // Calculate Mod 97 control digits
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
