import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptText, AlertTriangle } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function VatCashTrap() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data, isLoading } = useQuery({
    queryKey: ["vat-cash-trap", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Get PDV periods
      const { data: periods } = await supabase
        .from("pdv_periods")
        .select("id, period_name, start_date, end_date, output_vat, input_vat, status")
        .eq("tenant_id", tenantId!)
        .order("start_date", { ascending: false })
        .limit(12);

      // Get invoices to compare paid vs total
      const { data: invoices } = await (supabase
        .from("invoices")
        .select("id, status, total_with_tax, tax_amount, invoice_date, paid_at")
        .eq("tenant_id", tenantId!) as any);

      // Group invoices by period to calculate cash collected
      const periodData = (periods || []).reverse().map(p => {
        const periodStart = new Date(p.start_date);
        const periodEnd = new Date(p.end_date);
        const outputVat = Number(p.output_vat) || 0;
        const inputVat = Number(p.input_vat) || 0;
        const liability = outputVat - inputVat;

        // Find invoices in this period
        let collectedVat = 0;
        for (const inv of invoices || []) {
          const invDate = new Date(inv.invoice_date);
          if (invDate >= periodStart && invDate <= periodEnd) {
            if (inv.status === "paid" && inv.paid_at) {
              collectedVat += Number(inv.tax_amount) || 0;
            }
          }
        }

        return {
          period: p.period_name,
          vatLiability: Math.round(liability),
          cashCollected: Math.round(collectedVat),
          gap: Math.round(Math.max(0, liability - collectedVat)),
          status: p.status,
        };
      });

      const totalLiability = periodData.reduce((s, p) => s + Math.max(0, p.vatLiability), 0);
      const totalCollected = periodData.reduce((s, p) => s + p.cashCollected, 0);
      const totalGap = totalLiability - totalCollected;

      // Get bank balance estimate
      const { data: bankLines } = await (supabase
        .from("journal_lines")
        .select("debit, credit, chart_of_accounts:account_id(code), journal:journal_entry_id(status, tenant_id)")
        .eq("journal.tenant_id", tenantId!) as any);

      let bankBalance = 0;
      for (const line of (bankLines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        const code = line.chart_of_accounts?.code || "";
        if (code.startsWith("24") || code.startsWith("20")) {
          bankBalance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      }

      const gapPctOfBank = bankBalance > 0 ? Math.round(totalGap / bankBalance * 100) : 0;

      return { periodData, totalLiability: Math.round(totalLiability), totalCollected: Math.round(totalCollected), totalGap: Math.round(totalGap), bankBalance: Math.round(bankBalance), gapPctOfBank };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("VAT Cash Trap Detector", "PDV zamka — detektor")} icon={ReceiptText} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("VAT Liability", "PDV obaveza")}</p><p className="text-2xl font-bold mt-1">{fmtNum(data?.totalLiability || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Cash Collected", "Naplaćeno")}</p><p className="text-2xl font-bold mt-1">{fmtNum(data?.totalCollected || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("VAT Gap", "PDV gep")}</p><p className={`text-2xl font-bold mt-1 ${(data?.totalGap || 0) > 0 ? "text-destructive" : ""}`}>{fmtNum(data?.totalGap || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Gap % of Bank", "Gep % stanja")}</p><p className={`text-2xl font-bold mt-1 ${(data?.gapPctOfBank || 0) > 50 ? "text-destructive" : ""}`}>{data?.gapPctOfBank || 0}%</p></CardContent></Card>
      </div>

      {(data?.totalGap || 0) > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">{t("VAT Cash Trap Warning", "Upozorenje: PDV zamka")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {sr
                  ? `Dugujete ${fmtNum(data?.totalGap || 0)} RSD PDV-a ali niste naplatili odgovarajući iznos od kupaca. Ovo je ${data?.gapPctOfBank || 0}% vašeg stanja na računu.`
                  : `You owe ${fmtNum(data?.totalGap || 0)} RSD in VAT but haven't collected the equivalent from customers. This represents ${data?.gapPctOfBank || 0}% of your bank balance.`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("VAT Liability vs Cash Collected by Period", "PDV obaveza vs naplaćeno po periodu")}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.periodData || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="period" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => `${fmtNum(v)} RSD`} />
              <Legend />
              <Bar dataKey="vatLiability" name={t("VAT Liability", "PDV obaveza")} fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cashCollected" name={t("Collected", "Naplaćeno")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {tenantId && data && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="vat_trap"
          data={{
            vatLiability: data.totalLiability,
            cashCollected: data.totalCollected,
            gap: data.totalGap,
            bankBalance: data.bankBalance,
            gapPercentOfBank: data.gapPctOfBank,
            periods: data.periodData.slice(-6),
          }}
        />
      )}
    </div>
  );
}
