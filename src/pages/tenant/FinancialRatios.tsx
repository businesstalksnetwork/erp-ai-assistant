import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Activity, Percent, Clock, DollarSign } from "lucide-react";

interface RatioCard {
  label: string;
  value: number;
  format: "ratio" | "percent" | "days";
  benchmark: { green: number; yellow: number };
  higherIsBetter: boolean;
  category: string;
  formula: string;
  components: { label: string; value: number }[];
  description: string;
  interpretation: string;
}

const fmtNum = (v: number) =>
  v.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

function getHealthLabel(value: number, benchmark: { green: number; yellow: number }, higherIsBetter: boolean, sr: boolean) {
  const isGreen = higherIsBetter ? value >= benchmark.green : value <= benchmark.green;
  const isYellow = higherIsBetter ? value >= benchmark.yellow : value <= benchmark.yellow;
  if (isGreen) return sr ? "Zdravo" : "Healthy";
  if (isYellow) return sr ? "Oprez" : "Caution";
  return sr ? "Rizik" : "Risk";
}

function buildInterpretation(label: string, value: number, benchmark: { green: number; yellow: number }, higherIsBetter: boolean, sr: boolean): string {
  const formatted = formatRatio(value, "ratio");
  const isGreen = higherIsBetter ? value >= benchmark.green : value <= benchmark.green;
  const isYellow = higherIsBetter ? value >= benchmark.yellow : value <= benchmark.yellow;

  if (isGreen) {
    return sr
      ? `Vaš ${label} od ${formatted} ukazuje na snažnu poziciju — znatno iznad industrijskog standarda.`
      : `Your ${label} of ${formatted} indicates a strong position — well above industry standard.`;
  }
  if (isYellow) {
    return sr
      ? `Vaš ${label} od ${formatted} je u opsegu opreza. Razmotrite mere za poboljšanje.`
      : `Your ${label} of ${formatted} is in the caution range. Consider measures to improve.`;
  }
  return sr
    ? `Vaš ${label} od ${formatted} je ispod preporučenog nivoa i zahteva pažnju.`
    : `Your ${label} of ${formatted} is below recommended levels and requires attention.`;
}

export default function FinancialRatios() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const [selectedCard, setSelectedCard] = useState<RatioCard | null>(null);

  const { data: ratios, isLoading } = useQuery({
    queryKey: ["financial-ratios", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("debit, credit, accounts:account_id(account_type, code), journal:journal_entry_id(status, tenant_id)") as any)
        .eq("journal.tenant_id", tenantId!);

      let assets = 0, liabilities = 0, equity = 0, revenue = 0, expenses = 0;
      let currentAssets = 0, currentLiabilities = 0, cash = 0, inventory = 0;

      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        const type = line.accounts?.account_type;
        const code = line.accounts?.code || "";
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        const net = debit - credit;

        if (type === "asset") {
          assets += net;
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

      const netIncome = revenue - expenses;
      const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
      const quickRatio = currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : 0;
      const cashRatio = currentLiabilities > 0 ? cash / currentLiabilities : 0;
      const grossMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0;
      const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0;
      const roa = assets > 0 ? (netIncome / assets) * 100 : 0;
      const roe = equity > 0 ? (netIncome / equity) * 100 : 0;
      const assetTurnover = assets > 0 ? revenue / assets : 0;
      const inventoryTurnover = inventory > 0 ? expenses / inventory : 0;
      const debtToEquity = equity > 0 ? liabilities / equity : 0;

      return {
        currentRatio, quickRatio, cashRatio, grossMargin, netMargin, roa, roe,
        assetTurnover, inventoryTurnover, dso, debtToEquity,
        // raw components for the detail dialog
        _raw: { assets, liabilities, equity, revenue, expenses, netIncome, currentAssets, currentLiabilities, cash, inventory, dso },
      };
    },
  });

  const raw = ratios?._raw || { assets: 0, liabilities: 0, equity: 0, revenue: 0, expenses: 0, netIncome: 0, currentAssets: 0, currentLiabilities: 0, cash: 0, inventory: 0, dso: 0 };

  const cards: RatioCard[] = [
    // Liquidity
    { label: sr ? "Tekući racio" : "Current Ratio", value: ratios?.currentRatio || 0, format: "ratio", benchmark: { green: 1.5, yellow: 1 }, higherIsBetter: true, category: sr ? "Likvidnost" : "Liquidity",
      formula: sr ? "Tekuća imovina / Tekuće obaveze" : "Current Assets / Current Liabilities",
      components: [{ label: sr ? "Tekuća imovina" : "Current Assets", value: raw.currentAssets }, { label: sr ? "Tekuće obaveze" : "Current Liabilities", value: raw.currentLiabilities }],
      description: sr ? "Meri sposobnost firme da pokrije kratkoročne obaveze tekućom imovinom." : "Measures the company's ability to cover short-term obligations with current assets.",
      interpretation: buildInterpretation(sr ? "Tekući racio" : "Current Ratio", ratios?.currentRatio || 0, { green: 1.5, yellow: 1 }, true, sr),
    },
    { label: sr ? "Brzi racio" : "Quick Ratio", value: ratios?.quickRatio || 0, format: "ratio", benchmark: { green: 1, yellow: 0.5 }, higherIsBetter: true, category: sr ? "Likvidnost" : "Liquidity",
      formula: sr ? "(Tekuća imovina - Zalihe) / Tekuće obaveze" : "(Current Assets - Inventory) / Current Liabilities",
      components: [{ label: sr ? "Tekuća imovina" : "Current Assets", value: raw.currentAssets }, { label: sr ? "Zalihe" : "Inventory", value: raw.inventory }, { label: sr ? "Tekuće obaveze" : "Current Liabilities", value: raw.currentLiabilities }],
      description: sr ? "Strožija mera likvidnosti koja isključuje zalihe." : "A stricter liquidity measure that excludes inventory.",
      interpretation: buildInterpretation(sr ? "Brzi racio" : "Quick Ratio", ratios?.quickRatio || 0, { green: 1, yellow: 0.5 }, true, sr),
    },
    { label: sr ? "Gotovinski racio" : "Cash Ratio", value: ratios?.cashRatio || 0, format: "ratio", benchmark: { green: 0.5, yellow: 0.2 }, higherIsBetter: true, category: sr ? "Likvidnost" : "Liquidity",
      formula: sr ? "Gotovina / Tekuće obaveze" : "Cash / Current Liabilities",
      components: [{ label: sr ? "Gotovina" : "Cash", value: raw.cash }, { label: sr ? "Tekuće obaveze" : "Current Liabilities", value: raw.currentLiabilities }],
      description: sr ? "Meri sposobnost plaćanja obaveza isključivo gotovinom." : "Measures the ability to pay obligations using only cash.",
      interpretation: buildInterpretation(sr ? "Gotovinski racio" : "Cash Ratio", ratios?.cashRatio || 0, { green: 0.5, yellow: 0.2 }, true, sr),
    },
    // Profitability
    { label: sr ? "Bruto marža" : "Gross Margin", value: ratios?.grossMargin || 0, format: "percent", benchmark: { green: 30, yellow: 15 }, higherIsBetter: true, category: sr ? "Profitabilnost" : "Profitability",
      formula: sr ? "(Prihod - Rashod) / Prihod × 100" : "(Revenue - Expenses) / Revenue × 100",
      components: [{ label: sr ? "Prihod" : "Revenue", value: raw.revenue }, { label: sr ? "Rashod" : "Expenses", value: raw.expenses }],
      description: sr ? "Procenat prihoda koji ostaje nakon oduzimanja rashoda." : "Percentage of revenue remaining after subtracting expenses.",
      interpretation: buildInterpretation(sr ? "Bruto marža" : "Gross Margin", ratios?.grossMargin || 0, { green: 30, yellow: 15 }, true, sr),
    },
    { label: sr ? "Neto marža" : "Net Margin", value: ratios?.netMargin || 0, format: "percent", benchmark: { green: 10, yellow: 5 }, higherIsBetter: true, category: sr ? "Profitabilnost" : "Profitability",
      formula: sr ? "Neto dobit / Prihod × 100" : "Net Income / Revenue × 100",
      components: [{ label: sr ? "Neto dobit" : "Net Income", value: raw.netIncome }, { label: sr ? "Prihod" : "Revenue", value: raw.revenue }],
      description: sr ? "Procenat prihoda koji ostaje kao neto dobit." : "Percentage of revenue that remains as net income.",
      interpretation: buildInterpretation(sr ? "Neto marža" : "Net Margin", ratios?.netMargin || 0, { green: 10, yellow: 5 }, true, sr),
    },
    { label: "ROA", value: ratios?.roa || 0, format: "percent", benchmark: { green: 5, yellow: 2 }, higherIsBetter: true, category: sr ? "Profitabilnost" : "Profitability",
      formula: sr ? "Neto dobit / Ukupna imovina × 100" : "Net Income / Total Assets × 100",
      components: [{ label: sr ? "Neto dobit" : "Net Income", value: raw.netIncome }, { label: sr ? "Ukupna imovina" : "Total Assets", value: raw.assets }],
      description: sr ? "Pokazuje koliko efikasno firma koristi imovinu za ostvarivanje dobiti." : "Shows how efficiently the company uses assets to generate profit.",
      interpretation: buildInterpretation("ROA", ratios?.roa || 0, { green: 5, yellow: 2 }, true, sr),
    },
    { label: "ROE", value: ratios?.roe || 0, format: "percent", benchmark: { green: 15, yellow: 8 }, higherIsBetter: true, category: sr ? "Profitabilnost" : "Profitability",
      formula: sr ? "Neto dobit / Kapital × 100" : "Net Income / Equity × 100",
      components: [{ label: sr ? "Neto dobit" : "Net Income", value: raw.netIncome }, { label: sr ? "Kapital" : "Equity", value: raw.equity }],
      description: sr ? "Prinos na uloženi kapital vlasnika." : "Return on owner's invested equity.",
      interpretation: buildInterpretation("ROE", ratios?.roe || 0, { green: 15, yellow: 8 }, true, sr),
    },
    // Efficiency
    { label: sr ? "Obrt imovine" : "Asset Turnover", value: ratios?.assetTurnover || 0, format: "ratio", benchmark: { green: 1, yellow: 0.5 }, higherIsBetter: true, category: sr ? "Efikasnost" : "Efficiency",
      formula: sr ? "Prihod / Ukupna imovina" : "Revenue / Total Assets",
      components: [{ label: sr ? "Prihod" : "Revenue", value: raw.revenue }, { label: sr ? "Ukupna imovina" : "Total Assets", value: raw.assets }],
      description: sr ? "Koliko prihoda generiše svaki dinar imovine." : "How much revenue each unit of assets generates.",
      interpretation: buildInterpretation(sr ? "Obrt imovine" : "Asset Turnover", ratios?.assetTurnover || 0, { green: 1, yellow: 0.5 }, true, sr),
    },
    { label: sr ? "Obrt zaliha" : "Inventory Turnover", value: ratios?.inventoryTurnover || 0, format: "ratio", benchmark: { green: 6, yellow: 3 }, higherIsBetter: true, category: sr ? "Efikasnost" : "Efficiency",
      formula: sr ? "Rashodi / Zalihe" : "Expenses / Inventory",
      components: [{ label: sr ? "Rashodi" : "Expenses", value: raw.expenses }, { label: sr ? "Zalihe" : "Inventory", value: raw.inventory }],
      description: sr ? "Koliko puta se zalihe obrnu tokom perioda." : "How many times inventory is sold and replaced during the period.",
      interpretation: buildInterpretation(sr ? "Obrt zaliha" : "Inventory Turnover", ratios?.inventoryTurnover || 0, { green: 6, yellow: 3 }, true, sr),
    },
    { label: "DSO", value: ratios?.dso || 0, format: "days", benchmark: { green: 30, yellow: 60 }, higherIsBetter: false, category: sr ? "Efikasnost" : "Efficiency",
      formula: sr ? "Prosek dana od fakture do naplate" : "Average days from invoice to payment",
      components: [{ label: sr ? "Prosečan DSO" : "Average DSO", value: raw.dso }],
      description: sr ? "Prosečan broj dana potreban za naplatu potraživanja." : "Average number of days to collect receivables.",
      interpretation: buildInterpretation("DSO", ratios?.dso || 0, { green: 30, yellow: 60 }, false, sr),
    },
    // Solvency
    { label: sr ? "Dug/Kapital" : "Debt-to-Equity", value: ratios?.debtToEquity || 0, format: "ratio", benchmark: { green: 1, yellow: 2 }, higherIsBetter: false, category: sr ? "Solventnost" : "Solvency",
      formula: sr ? "Ukupne obaveze / Kapital" : "Total Liabilities / Equity",
      components: [{ label: sr ? "Ukupne obaveze" : "Total Liabilities", value: raw.liabilities }, { label: sr ? "Kapital" : "Equity", value: raw.equity }],
      description: sr ? "Odnos duga prema sopstvenom kapitalu — meri finansijski leveridž." : "Ratio of debt to equity — measures financial leverage.",
      interpretation: buildInterpretation(sr ? "Dug/Kapital" : "Debt-to-Equity", ratios?.debtToEquity || 0, { green: 1, yellow: 2 }, false, sr),
    },
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
                  <Card
                    key={card.label}
                    className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md hover:border-primary/30"
                    onClick={() => setSelectedCard(card)}
                  >
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="text-2xl font-bold">{formatRatio(card.value, card.format)}</span>
                        <Badge className={`text-[10px] ${getHealthColor(card.value, card.benchmark, card.higherIsBetter)}`}>
                          ●
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          {selectedCard && (() => {
            const healthColor = getHealthColor(selectedCard.value, selectedCard.benchmark, selectedCard.higherIsBetter);
            const healthLabel = getHealthLabel(selectedCard.value, selectedCard.benchmark, selectedCard.higherIsBetter, sr);
            const isGreen = selectedCard.higherIsBetter
              ? selectedCard.value >= selectedCard.benchmark.green
              : selectedCard.value <= selectedCard.benchmark.green;
            const isYellow = selectedCard.higherIsBetter
              ? selectedCard.value >= selectedCard.benchmark.yellow
              : selectedCard.value <= selectedCard.benchmark.yellow;
            const accentBorder = isGreen ? "border-green-500" : isYellow ? "border-yellow-500" : "border-destructive";
            const accentBg = isGreen ? "bg-green-500/10" : isYellow ? "bg-yellow-500/10" : "bg-destructive/10";

            // Gauge position (0-100%)
            const { green, yellow } = selectedCard.benchmark;
            const rangeMax = selectedCard.higherIsBetter ? green * 2 : yellow * 2;
            const clampedVal = Math.max(0, Math.min(selectedCard.value, rangeMax));
            const gaugePercent = rangeMax > 0 ? (clampedVal / rangeMax) * 100 : 50;

            return (
              <>
                {/* Header */}
                <div className="px-6 pt-6 pb-4">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-lg">
                      {selectedCard.label}
                      <Badge className={`text-xs ${healthColor}`}>{healthLabel}</Badge>
                    </DialogTitle>
                    <DialogDescription className="mt-1">{selectedCard.description}</DialogDescription>
                  </DialogHeader>
                </div>

                <Separator />

                <div className="px-6 py-5 space-y-5">
                  {/* Hero Value */}
                  <div className="text-center py-2">
                    <span className="text-5xl font-bold tracking-tight">{formatRatio(selectedCard.value, selectedCard.format)}</span>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
                      {selectedCard.format === "percent" ? "%" : selectedCard.format === "days" ? (sr ? "dana" : "days") : (sr ? "racio" : "ratio")}
                    </p>
                  </div>

                  {/* Benchmark Gauge */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {sr ? "Benčmark" : "Benchmark"}
                    </p>
                    <div className="relative">
                      <div className="h-3 w-full flex rounded-full overflow-hidden">
                        {selectedCard.higherIsBetter ? (
                          <>
                            <div className="bg-destructive/70 h-full" style={{ width: "30%" }} />
                            <div className="bg-yellow-500/70 h-full" style={{ width: "30%" }} />
                            <div className="bg-green-500/70 h-full" style={{ width: "40%" }} />
                          </>
                        ) : (
                          <>
                            <div className="bg-green-500/70 h-full" style={{ width: "40%" }} />
                            <div className="bg-yellow-500/70 h-full" style={{ width: "30%" }} />
                            <div className="bg-destructive/70 h-full" style={{ width: "30%" }} />
                          </>
                        )}
                      </div>
                      {/* Marker */}
                      <div
                        className="absolute -top-1 w-0.5 h-5 bg-foreground rounded-full"
                        style={{ left: `${Math.max(2, Math.min(98, gaugePercent))}%`, transform: "translateX(-50%)" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{selectedCard.higherIsBetter ? (sr ? "Rizik" : "Risk") : (sr ? "Zdravo" : "Healthy")}</span>
                      <span>{sr ? "Oprez" : "Caution"}</span>
                      <span>{selectedCard.higherIsBetter ? (sr ? "Zdravo" : "Healthy") : (sr ? "Rizik" : "Risk")}</span>
                    </div>
                  </div>

                  {/* Formula */}
                  <div className={`rounded-md border-l-2 border-primary bg-primary/5 px-4 py-3`}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {sr ? "Formula" : "Formula"}
                    </p>
                    <p className="text-sm font-mono">{selectedCard.formula}</p>
                  </div>

                  {/* Components */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 pb-1 border-b">
                      {sr ? "Komponente" : "Components"}
                    </p>
                    <div className="space-y-0.5">
                      {selectedCard.components.map((c, idx) => (
                        <div key={c.label} className={`flex justify-between items-center text-sm px-3 py-1.5 rounded ${idx % 2 === 0 ? "bg-muted/50" : ""}`}>
                          <span className="text-muted-foreground">{c.label}</span>
                          <span className="font-medium font-mono tabular-nums">{fmtNum(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interpretation */}
                  <div className={`rounded-md border-l-2 ${accentBorder} ${accentBg} px-4 py-3`}>
                    <p className="text-sm leading-relaxed">{selectedCard.interpretation}</p>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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
