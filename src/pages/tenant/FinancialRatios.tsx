import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Activity, TrendingUp, DollarSign, Percent, Clock, Package } from "lucide-react";

interface RatioCard {
  label: string;
  value: number;
  format: "ratio" | "percent" | "days";
  benchmark: { green: number; yellow: number }; // thresholds
  higherIsBetter: boolean;
  category: string;
}

function formatRatio(value: number, format: string) {
  if (format === "percent") return `${value.toFixed(1)}%`;
  if (format === "days") return `${Math.round(value)}d`;
  return value.toFixed(2);
}

function getHealthColor(value: number, benchmark: { green: number; yellow: number }, higherIsBetter: boolean) {
  if (higherIsBetter) {
    if (value >= benchmark.green) return "bg-accent text-accent-foreground";
    if (value >= benchmark.yellow) return "bg-warning text-warning-foreground";
    return "bg-destructive text-destructive-foreground";
  }
  if (value <= benchmark.green) return "bg-accent text-accent-foreground";
  if (value <= benchmark.yellow) return "bg-warning text-warning-foreground";
  return "bg-destructive text-destructive-foreground";
}

export default function FinancialRatios() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";

  const { data: ratios, isLoading } = useQuery({
    queryKey: ["financial-ratios", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("amount, side, accounts:account_id(account_type, code), journal:journal_entry_id(status)") as any)
        .eq("tenant_id", tenantId!);

      let assets = 0, liabilities = 0, equity = 0, revenue = 0, expenses = 0;
      let currentAssets = 0, currentLiabilities = 0, cash = 0, inventory = 0;

      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        const type = line.accounts?.account_type;
        const code = line.accounts?.code || "";
        const amt = Number(line.amount) || 0;
        const net = line.side === "debit" ? amt : -amt;

        if (type === "asset") {
          assets += net;
          // Current assets: codes starting with 1-2
          if (code.startsWith("1") || code.startsWith("2")) currentAssets += net;
          if (code.startsWith("24") || code.startsWith("10")) cash += net;
          if (code.startsWith("13") || code.startsWith("14")) inventory += net;
        } else if (type === "liability") {
          liabilities += -net;
          if (code.startsWith("4") || code.startsWith("43")) currentLiabilities += -net;
        } else if (type === "equity") {
          equity += -net;
        } else if (type === "revenue") {
          revenue += -net;
        } else if (type === "expense") {
          expenses += net;
        }
      }

      // Fetch DSO from invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("total, status, invoice_date, paid_at")
        .eq("tenant_id", tenantId!);

      const paidInvs = (invoices || []).filter((i: any) => i.status === "paid" && i.paid_at);
      let dso = 0;
      if (paidInvs.length > 0) {
        const totalDays = paidInvs.reduce((s: number, i: any) => {
          return s + (new Date(i.paid_at).getTime() - new Date(i.invoice_date).getTime()) / 86400000;
        }, 0);
        dso = totalDays / paidInvs.length;
      }

      const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
      const quickRatio = currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : 0;
      const cashRatio = currentLiabilities > 0 ? cash / currentLiabilities : 0;
      const grossMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
      const netMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
      const roa = assets > 0 ? ((revenue - expenses) / assets) * 100 : 0;
      const roe = equity > 0 ? ((revenue - expenses) / equity) * 100 : 0;
      const assetTurnover = assets > 0 ? revenue / assets : 0;
      const inventoryTurnover = inventory > 0 ? expenses / inventory : 0;
      const debtToEquity = equity > 0 ? liabilities / equity : 0;

      return { currentRatio, quickRatio, cashRatio, grossMargin, netMargin, roa, roe, assetTurnover, inventoryTurnover, dso, debtToEquity };
    },
  });

  const cards: RatioCard[] = [
    // Liquidity
    { label: sr ? "Tekući racio" : "Current Ratio", value: ratios?.currentRatio || 0, format: "ratio", benchmark: { green: 1.5, yellow: 1 }, higherIsBetter: true, category: sr ? "Likvidnost" : "Liquidity" },
    { label: sr ? "Brzi racio" : "Quick Ratio", value: ratios?.quickRatio || 0, format: "ratio", benchmark: { green: 1, yellow: 0.5 }, higherIsBetter: true, category: sr ? "Likvidnost" : "Liquidity" },
    { label: sr ? "Gotovinski racio" : "Cash Ratio", value: ratios?.cashRatio || 0, format: "ratio", benchmark: { green: 0.5, yellow: 0.2 }, higherIsBetter: true, category: sr ? "Likvidnost" : "Liquidity" },
    // Profitability
    { label: sr ? "Bruto marža" : "Gross Margin", value: ratios?.grossMargin || 0, format: "percent", benchmark: { green: 30, yellow: 15 }, higherIsBetter: true, category: sr ? "Profitabilnost" : "Profitability" },
    { label: sr ? "Neto marža" : "Net Margin", value: ratios?.netMargin || 0, format: "percent", benchmark: { green: 10, yellow: 5 }, higherIsBetter: true, category: sr ? "Profitabilnost" : "Profitability" },
    { label: "ROA", value: ratios?.roa || 0, format: "percent", benchmark: { green: 5, yellow: 2 }, higherIsBetter: true, category: sr ? "Profitabilnost" : "Profitability" },
    { label: "ROE", value: ratios?.roe || 0, format: "percent", benchmark: { green: 15, yellow: 8 }, higherIsBetter: true, category: sr ? "Profitabilnost" : "Profitability" },
    // Efficiency
    { label: sr ? "Obrt imovine" : "Asset Turnover", value: ratios?.assetTurnover || 0, format: "ratio", benchmark: { green: 1, yellow: 0.5 }, higherIsBetter: true, category: sr ? "Efikasnost" : "Efficiency" },
    { label: sr ? "Obrt zaliha" : "Inventory Turnover", value: ratios?.inventoryTurnover || 0, format: "ratio", benchmark: { green: 6, yellow: 3 }, higherIsBetter: true, category: sr ? "Efikasnost" : "Efficiency" },
    { label: "DSO", value: ratios?.dso || 0, format: "days", benchmark: { green: 30, yellow: 60 }, higherIsBetter: false, category: sr ? "Efikasnost" : "Efficiency" },
    // Solvency
    { label: sr ? "Dug/Kapital" : "Debt-to-Equity", value: ratios?.debtToEquity || 0, format: "ratio", benchmark: { green: 1, yellow: 2 }, higherIsBetter: false, category: sr ? "Solventnost" : "Solvency" },
  ];

  const categories = [...new Set(cards.map(c => c.category))];
  const categoryIcons: Record<string, any> = {
    Liquidity: Activity, Likvidnost: Activity,
    Profitability: Percent, Profitabilnost: Percent,
    Efficiency: Clock, Efikasnost: Clock,
    Solvency: DollarSign, Solventnost: DollarSign,
  };

  return (
    <div className="space-y-6">
      <PageHeader title={sr ? "Finansijski raciji" : "Financial Ratios"} />

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        categories.map(cat => {
          const Icon = categoryIcons[cat] || Activity;
          return (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Icon className="h-4 w-4" /> {cat}
              </h3>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {cards.filter(c => c.category === cat).map(card => (
                  <Card key={card.label}>
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="text-2xl font-bold">{formatRatio(card.value, card.format)}</span>
                        <Badge className={`text-[10px] ${getHealthColor(card.value, card.benchmark, card.higherIsBetter)}`}>
                          {card.value >= card.benchmark.green === card.higherIsBetter ? "●" : card.value >= card.benchmark.yellow === card.higherIsBetter ? "●" : "●"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}

      {tenantId && ratios && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="ratios"
          data={{
            currentRatio: ratios.currentRatio,
            quickRatio: ratios.quickRatio,
            cashRatio: ratios.cashRatio,
            grossMargin: ratios.grossMargin,
            netMargin: ratios.netMargin,
            roa: ratios.roa,
            roe: ratios.roe,
            assetTurnover: ratios.assetTurnover,
            inventoryTurnover: ratios.inventoryTurnover,
            dso: ratios.dso,
            debtToEquity: ratios.debtToEquity,
          }}
        />
      )}
    </div>
  );
}
