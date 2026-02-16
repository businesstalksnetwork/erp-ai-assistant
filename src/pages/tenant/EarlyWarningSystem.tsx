import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, CreditCard, Clock } from "lucide-react";

interface Anomaly {
  type: "expense_spike" | "duplicate_payment" | "unusual_posting";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  amount?: number;
  date?: string;
}

export default function EarlyWarningSystem() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data, isLoading } = useQuery({
    queryKey: ["early-warning", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Get journal lines with account info
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("debit, credit, chart_of_accounts:account_id(account_type, code, name), journal:journal_entry_id(status, entry_date, tenant_id, reference, description)")
        .eq("journal.tenant_id", tenantId!) as any);

      // Detect expense spikes: compare current month vs 3-month average
      const accountMonthly = new Map<string, { name: string; months: Map<string, number> }>();
      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        if (line.chart_of_accounts?.account_type !== "expense") continue;
        const code = line.chart_of_accounts.code;
        const d = line.journal.entry_date || "";
        const monthKey = d.substring(0, 7);
        const val = (Number(line.debit) || 0) - (Number(line.credit) || 0);

        if (!accountMonthly.has(code)) {
          accountMonthly.set(code, { name: line.chart_of_accounts.name, months: new Map() });
        }
        const acc = accountMonthly.get(code)!;
        acc.months.set(monthKey, (acc.months.get(monthKey) || 0) + val);
      }

      const anomalies: Anomaly[] = [];
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      for (const [code, acc] of accountMonthly) {
        const currentVal = acc.months.get(currentMonth) || 0;
        if (currentVal <= 0) continue;

        // 3-month average excluding current month
        let total = 0, count = 0;
        for (const [mk, mv] of acc.months) {
          if (mk !== currentMonth && mk >= threeMonthsAgo.toISOString().substring(0, 7)) {
            total += mv;
            count++;
          }
        }
        const avg = count > 0 ? total / count : 0;
        if (avg > 0 && currentVal > avg * 3) {
          anomalies.push({
            type: "expense_spike",
            severity: currentVal > avg * 5 ? "high" : "medium",
            title: sr ? `Skok rashoda: ${acc.name} (${code})` : `Expense Spike: ${acc.name} (${code})`,
            description: sr
              ? `Ovomesečni iznos ${Math.round(currentVal).toLocaleString()} je ${Math.round(currentVal / avg * 100)}% proseka (${Math.round(avg).toLocaleString()}).`
              : `Current month ${Math.round(currentVal).toLocaleString()} is ${Math.round(currentVal / avg * 100)}% of 3-month avg (${Math.round(avg).toLocaleString()}).`,
            amount: Math.round(currentVal),
          });
        }
      }

      // Detect duplicate payments: same amount + same partner within 7 days
      const { data: bankLines } = await supabase
        .from("bank_statement_lines")
        .select("id, amount, partner_name, line_date, direction")
        .eq("tenant_id", tenantId!)
        .eq("direction", "outflow")
        .order("line_date", { ascending: false })
        .limit(500);

      const seen = new Map<string, { date: string; amount: number }>();
      for (const bl of bankLines || []) {
        const key = `${bl.partner_name}_${bl.amount}`;
        const existing = seen.get(key);
        if (existing) {
          const daysDiff = Math.abs(new Date(bl.line_date).getTime() - new Date(existing.date).getTime()) / 86400000;
          if (daysDiff <= 7 && daysDiff > 0) {
            anomalies.push({
              type: "duplicate_payment",
              severity: "high",
              title: sr ? `Moguće duplo plaćanje: ${bl.partner_name}` : `Possible Duplicate Payment: ${bl.partner_name}`,
              description: sr
                ? `Dva plaćanja od ${Math.round(Number(bl.amount)).toLocaleString()} RSD istom partneru u roku od ${Math.round(daysDiff)} dana.`
                : `Two payments of ${Math.round(Number(bl.amount)).toLocaleString()} RSD to same partner within ${Math.round(daysDiff)} days.`,
              amount: Number(bl.amount),
              date: bl.line_date,
            });
          }
        }
        seen.set(key, { date: bl.line_date, amount: Number(bl.amount) });
      }

      // Detect unusual posting times from audit log
      const { data: auditEntries } = await supabase
        .from("audit_log")
        .select("action, entity_type, created_at, details")
        .eq("tenant_id", tenantId!)
        .in("entity_type", ["journal_entry", "journal_entries"])
        .order("created_at", { ascending: false })
        .limit(200);

      for (const entry of auditEntries || []) {
        const hour = new Date(entry.created_at).getHours();
        if (hour < 6 || hour > 22) {
          anomalies.push({
            type: "unusual_posting",
            severity: "medium",
            title: sr ? `Knjiženje van radnog vremena` : `After-Hours Posting`,
            description: sr
              ? `Knjiženje u ${hour}:00h — ${entry.action} ${entry.entity_type}.`
              : `Posting at ${hour}:00h — ${entry.action} ${entry.entity_type}.`,
            date: entry.created_at,
          });
        }
      }

      anomalies.sort((a, b) => (a.severity === "high" ? 0 : a.severity === "medium" ? 1 : 2) - (b.severity === "high" ? 0 : b.severity === "medium" ? 1 : 2));

      return {
        anomalies,
        highCount: anomalies.filter(a => a.severity === "high").length,
        mediumCount: anomalies.filter(a => a.severity === "medium").length,
        totalCount: anomalies.length,
      };
    },
  });

  const severityColors: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-orange-500/10 text-orange-700 border-orange-500/20",
    low: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  };

  const typeIcons: Record<string, typeof AlertTriangle> = {
    expense_spike: TrendingUp,
    duplicate_payment: CreditCard,
    unusual_posting: Clock,
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Early Warning System", "Rani sistem upozorenja")} icon={AlertTriangle} />

      <div className="grid gap-3 grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Total Anomalies", "Ukupno anomalija")}</p><p className="text-2xl font-bold mt-1">{data?.totalCount || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("High Severity", "Visoka ozbiljnost")}</p><p className="text-2xl font-bold mt-1 text-destructive">{data?.highCount || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Medium Severity", "Srednja ozbiljnost")}</p><p className="text-2xl font-bold mt-1 text-orange-600">{data?.mediumCount || 0}</p></CardContent></Card>
      </div>

      {(data?.anomalies || []).length === 0 && (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-6 text-center">
            <p className="text-green-700 font-medium">{t("No anomalies detected. All systems normal.", "Nema otkrivenih anomalija. Svi sistemi normalni.")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(data?.anomalies || []).map((anomaly, i) => {
          const Icon = typeIcons[anomaly.type] || AlertTriangle;
          return (
            <Card key={i} className="border-l-4" style={{ borderLeftColor: anomaly.severity === "high" ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}>
              <CardContent className="p-4 flex items-start gap-3">
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${anomaly.severity === "high" ? "text-destructive" : "text-orange-600"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{anomaly.title}</span>
                    <Badge variant="outline" className={severityColors[anomaly.severity]}>
                      {anomaly.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {tenantId && data && data.anomalies.length > 0 && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="early_warning"
          data={{
            totalAnomalies: data.totalCount,
            highSeverity: data.highCount,
            anomalySummary: data.anomalies.slice(0, 10).map(a => ({ type: a.type, severity: a.severity, title: a.title })),
          }}
        />
      )}
    </div>
  );
}
