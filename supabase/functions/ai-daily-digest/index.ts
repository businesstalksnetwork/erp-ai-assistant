import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLE_SECTIONS: Record<string, string[]> = {
  admin: ["invoices", "journals", "pos", "purchasing", "payroll", "stock", "alerts"],
  manager: ["invoices", "journals", "pos", "purchasing", "stock", "alerts"],
  finance_director: ["invoices", "journals", "payroll", "alerts"],
  accountant: ["invoices", "journals", "payroll", "alerts"],
  sales: ["invoices", "pos", "alerts"],
  sales_manager: ["invoices", "pos", "alerts"],
  sales_rep: ["invoices", "pos", "alerts"],
  hr: ["payroll", "alerts"],
  hr_manager: ["payroll", "alerts"],
  hr_staff: ["payroll", "alerts"],
  store: ["pos", "stock", "alerts"],
  store_manager: ["pos", "stock", "alerts"],
  cashier: ["pos", "alerts"],
  warehouse_manager: ["stock", "purchasing", "alerts"],
  warehouse_worker: ["stock", "alerts"],
  production_manager: ["stock", "purchasing", "alerts"],
  production_worker: ["stock", "alerts"],
  user: ["alerts"],
  viewer: ["alerts"],
};

type TimeOfDay = "morning" | "midday" | "evening";

const GREETINGS: Record<TimeOfDay, Record<string, string>> = {
  morning: { sr: "Dobro jutro", en: "Good morning" },
  midday: { sr: "Dnevni pregled", en: "Midday Update" },
  evening: { sr: "Završni pregled dana", en: "End of Day Recap" },
};

const DIGEST_TITLES: Record<TimeOfDay, Record<string, string>> = {
  morning: { sr: "Jutarnji pregled", en: "Morning Briefing" },
  midday: { sr: "Podnevni pregled", en: "Midday Briefing" },
  evening: { sr: "Večernji pregled", en: "Evening Briefing" },
};

const EMOJIS: Record<TimeOfDay, string> = {
  morning: "☀️",
  midday: "🌤️",
  evening: "🌙",
};

/**
 * Convert a Serbian first name to vocative case (vokativ).
 */
function toVocative(name: string): string {
  if (!name || name.length < 2) return name;
  const lower = name.toLowerCase();
  if (lower.endsWith("a") || lower.endsWith("e") || lower.endsWith("o") || lower.endsWith("i")) return name;
  if (lower.endsWith("ar")) return name.slice(0, -2) + "re";
  if (lower.endsWith("k")) return name.slice(0, -1) + "če";
  if (lower.endsWith("g")) return name.slice(0, -1) + "že";
  return name + "e";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, language = "en", time_of_day } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine time period
    const period: TimeOfDay = time_of_day || "morning";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership & get role
    const { data: member } = await supabase.from("tenant_members")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .maybeSingle();

    let userRole = "user";
    if (!member) {
      const { data: superRole } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
      if (!superRole) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userRole = "admin";
    } else {
      userRole = member.role || "user";
    }

    // Get user's first name
    const { data: employee } = await supabase.from("employees")
      .select("first_name")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const firstName = employee?.first_name || user.user_metadata?.first_name || "";
    const allowedSections = ROLE_SECTIONS[userRole] || ROLE_SECTIONS.user;

    const sr = language === "sr";
    const lang = sr ? "sr" : "en";
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // Date range depends on period:
    // morning → yesterday's data; midday/evening → today's data so far
    const rangeStart = period === "morning" ? yesterday : today;
    const rangeEnd = period === "morning" ? today : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [invoicesRes, journalsRes, stockRes, payrollRes, posRes, poRes] = await Promise.all([
      supabase.from("invoices").select("id, total, status", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", rangeStart).lt("created_at", rangeEnd),
      supabase.from("journal_entries").select("id", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", rangeStart).lt("created_at", rangeEnd),
      supabase.from("inventory_stock").select("product_id, quantity_on_hand, min_stock_level").eq("tenant_id", tenant_id).gt("min_stock_level", 0),
      supabase.from("payroll_runs").select("id, total_gross, status", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", rangeStart).lt("created_at", rangeEnd),
      supabase.from("pos_transactions").select("id, total_amount, transaction_type", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", rangeStart).lt("created_at", rangeEnd),
      supabase.from("purchase_orders").select("id, status", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", rangeStart).lt("created_at", rangeEnd),
    ]);

    const newInvoiceCount = invoicesRes.count || 0;
    const invoiceTotal = (invoicesRes.data || []).reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const newJournalCount = journalsRes.count || 0;
    const lowStockItems = (stockRes.data || []).filter((s: any) => Number(s.quantity_on_hand) < Number(s.min_stock_level));
    const zeroStockItems = (stockRes.data || []).filter((s: any) => Number(s.quantity_on_hand) <= 0);
    const newPayrollCount = payrollRes.count || 0;
    const payrollTotal = (payrollRes.data || []).reduce((s: number, p: any) => s + Number(p.total_gross || 0), 0);
    const posCount = posRes.count || 0;
    const posTotal = (posRes.data || []).reduce((s: number, t: any) => s + Number(t.total_amount || 0), 0);
    const newPOCount = poRes.count || 0;

    // Period-specific labels
    const periodLabel = period === "morning"
      ? (sr ? "jučerašnji" : "yesterday's")
      : period === "midday"
        ? (sr ? "današnji (do sada)" : "today's (so far)")
        : (sr ? "današnji" : "today's");

    const sections: string[] = [];

    if (allowedSections.includes("invoices") && newInvoiceCount > 0) {
      sections.push(sr
        ? `📄 **Fakture**: ${newInvoiceCount} ${periodLabel} faktura (ukupno ${invoiceTotal.toLocaleString("sr-RS")} RSD)`
        : `📄 **Invoices**: ${newInvoiceCount} ${periodLabel} invoices (total ${invoiceTotal.toLocaleString("en-US")} RSD)`);
    }

    if (allowedSections.includes("journals") && newJournalCount > 0) {
      sections.push(sr
        ? `📝 **Knjiženja**: ${newJournalCount} ${periodLabel} naloga za knjiženje`
        : `📝 **Journal Entries**: ${newJournalCount} ${periodLabel} entries`);
    }

    if (allowedSections.includes("pos") && posCount > 0) {
      sections.push(sr
        ? `🏪 **POS**: ${posCount} transakcija (ukupno ${posTotal.toLocaleString("sr-RS")} RSD)`
        : `🏪 **POS**: ${posCount} transactions (total ${posTotal.toLocaleString("en-US")} RSD)`);
    }

    if (allowedSections.includes("purchasing") && newPOCount > 0) {
      sections.push(sr
        ? `🚚 **Nabavka**: ${newPOCount} naloga za nabavku`
        : `🚚 **Purchasing**: ${newPOCount} purchase orders`);
    }

    if (allowedSections.includes("payroll") && newPayrollCount > 0) {
      sections.push(sr
        ? `💰 **Plate**: ${newPayrollCount} obračuna (ukupno ${payrollTotal.toLocaleString("sr-RS")} RSD)`
        : `💰 **Payroll**: ${newPayrollCount} runs (total ${payrollTotal.toLocaleString("en-US")} RSD)`);
    }

    if (allowedSections.includes("stock")) {
      if (zeroStockItems.length > 0) {
        sections.push(sr
          ? `🚨 **Zalihe**: ${zeroStockItems.length} artikala bez zaliha`
          : `🚨 **Stock Alert**: ${zeroStockItems.length} items out of stock`);
      } else if (lowStockItems.length > 0) {
        sections.push(sr
          ? `⚠️ **Zalihe**: ${lowStockItems.length} artikala sa niskim zalihama`
          : `⚠️ **Stock Alert**: ${lowStockItems.length} items below minimum`);
      }
    }

    // Pending tasks summary for evening briefing
    if (period === "evening") {
      const { count: pendingTaskCount } = await supabase
        .from("user_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("tenant_id", tenant_id)
        .eq("is_completed", false);

      if (pendingTaskCount && pendingTaskCount > 0) {
        sections.push(sr
          ? `📋 **Zadaci**: ${pendingTaskCount} otvorenih zadataka za sutra`
          : `📋 **Tasks**: ${pendingTaskCount} open tasks to carry over`);
      }
    }

    // AI alerts
    if (allowedSections.includes("alerts")) {
      const { data: criticalInsights } = await supabase
        .from("ai_insights_cache")
        .select("title, severity")
        .eq("tenant_id", tenant_id)
        .in("severity", ["critical", "warning"])
        .gt("expires_at", new Date().toISOString())
        .limit(5);

      if (criticalInsights && criticalInsights.length > 0) {
        const alertList = criticalInsights.map((i: any) =>
          `${i.severity === "critical" ? "🔴" : "🟡"} ${i.title}`
        ).join("\n");
        sections.push(sr
          ? `\n**AI Upozorenja**:\n${alertList}`
          : `\n**AI Alerts**:\n${alertList}`);
      }
    }

    // Build personalized greeting (apply Serbian vocative case)
    const displayName = sr ? toVocative(firstName) : firstName;
    const greetingText = displayName
      ? `${GREETINGS[period][lang]}, ${displayName}`
      : GREETINGS[period][lang];

    const digestTitle = DIGEST_TITLES[period][lang];
    const dateStr = new Date(rangeStart).toLocaleDateString(sr ? "sr-Latn-RS" : "en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const header = `## ${greetingText} ${EMOJIS[period]}\n### ${digestTitle} — ${dateStr}`;

    const noDataMsg = period === "morning"
      ? (sr ? `Nema značajnih promena za ${dateStr}.` : `No significant changes for ${dateStr}.`)
      : period === "midday"
        ? (sr ? `Nema aktivnosti danas do sada.` : `No activity today so far.`)
        : (sr ? `Miran dan — nema značajnih promena.` : `Quiet day — no significant changes.`);

    const digest = sections.length > 0
      ? `${header}\n\n${sections.join("\n\n")}`
      : `${header}\n\n${noDataMsg}`;

    // Log action
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id, user_id: user.id, action_type: "daily_digest", module: "analytics",
        model_version: "rule-based-v3", reasoning: `Generated ${period} digest for role=${userRole} with ${sections.length} sections`,
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ digest, date: rangeStart, sections_count: sections.length, time_of_day: period }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-daily-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
