import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

async function isNationalHoliday(supabase: any, dateStr: string): Promise<boolean> {
  const { data } = await supabase
    .from("holidays")
    .select("id")
    .is("tenant_id", null)
    .eq("date", dateStr)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function getLastWorkingDay(supabase: any): Promise<string> {
  const d = new Date();
  for (let i = 0; i < 10; i++) {
    const dateStr = formatDate(d);
    if (!isWeekend(d) && !(await isNationalHoliday(supabase, dateStr))) {
      return dateStr;
    }
    d.setDate(d.getDate() - 1);
  }
  throw new Error("Could not determine last working day within 10-day window");
}

async function sendAdminNotification(
  supabase: any, tenant_id: string, date: string
) {
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenant_id)
    .eq("role", "admin");

  if (!admins?.length) return;

  const rows = admins.map((a: any) => ({
    tenant_id,
    user_id: a.user_id,
    type: "warning",
    category: "system",
    title: "NBS Exchange Rate Import Failed",
    message: `Failed to fetch exchange rates from NBS for ${date}. Rates were NOT imported. Please retry or enter rates manually.`,
    entity_type: "exchange_rates",
    entity_id: null,
  }));

  await supabase.from("notifications").insert(rows);
}

async function fetchAndImportRates(supabase: any, tenant_id: string, targetDate: string) {
  const nbsUrl = `https://nbs.rs/kursnaListaMod498/kursnaLista?date=${targetDate}&type=3`;
  let rates: Array<{ code: string; rate: number }> = [];

  try {
    const nbsRes = await fetch(nbsUrl);
    if (nbsRes.ok) {
      const text = await nbsRes.text();
      const currencyMatches = text.matchAll(
        /<currency_code>([A-Z]{3})<\/currency_code>[\s\S]*?<middle_rate>([\d.,]+)<\/middle_rate>/gi
      );
      for (const match of currencyMatches) {
        const code = match[1];
        const rate = parseFloat(match[2].replace(",", "."));
        if (code && !isNaN(rate)) {
          rates.push({ code, rate });
        }
      }
    }
  } catch (fetchErr) {
    console.error("NBS API fetch failed:", fetchErr);
  }

  if (rates.length === 0) {
    await sendAdminNotification(supabase, tenant_id, targetDate);
    return { tenant_id, imported: 0, error: "No rates from NBS" };
  }

  let imported = 0;
  for (const { code, rate } of rates) {
    const { error } = await supabase.from("exchange_rates").upsert(
      {
        tenant_id,
        from_currency: code,
        to_currency: "RSD",
        rate,
        rate_date: targetDate,
        source: "NBS",
      },
      { onConflict: "tenant_id,from_currency,to_currency,rate_date" }
    );
    if (!error) imported++;
  }

  return { tenant_id, imported };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty body for cron calls
    }

    const { tenant_id } = body;
    const targetDate = await getLastWorkingDay(supabase);

    // CRON MODE: no tenant_id — import for all tenants with currencies
    if (!tenant_id) {
      const { data: tenantRows } = await supabase
        .from("currencies")
        .select("tenant_id")
        .eq("is_active", true);

      const uniqueTenants = [...new Set((tenantRows || []).map((r: any) => r.tenant_id))];

      if (uniqueTenants.length === 0) {
        return new Response(JSON.stringify({ success: true, mode: "cron", message: "No tenants with active currencies" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const results = [];
      for (const tid of uniqueTenants) {
        const result = await fetchAndImportRates(supabase, tid as string, targetDate);
        results.push(result);
      }

      return new Response(JSON.stringify({ success: true, mode: "cron", date: targetDate, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // USER MODE: validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await fetchAndImportRates(supabase, tenant_id, targetDate);

    if (result.error) {
      return new Response(
        JSON.stringify({ error: "NBS API returned no exchange rates", details: `No rates for ${targetDate}. Admin notified.` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = formatDate(new Date());
    const adjusted = targetDate !== today;

    return new Response(
      JSON.stringify({
        success: true,
        imported: result.imported,
        date: targetDate,
        adjusted,
        ...(adjusted ? { originalDate: today, reason: "Weekend or national holiday" } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
