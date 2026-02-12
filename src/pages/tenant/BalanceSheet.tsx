import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { PrintButton } from "@/components/PrintButton";

export default function BalanceSheet() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["balance_sheet", tenantId, asOfDate],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("journal_lines")
        .select(`
          debit, credit,
          account:chart_of_accounts!inner(id, code, name, account_type),
          journal_entry:journal_entries!inner(status, entry_date, tenant_id)
        `)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .in("account.account_type", ["asset", "liability", "equity"]);

      if (asOfDate) query = query.lte("journal_entry.entry_date", asOfDate);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const { assets, liabilities, equityAccounts, totalAssets, totalLiabilities, totalEquity } = useMemo(() => {
    const map = new Map<string, { account: any; balance: number }>();
    for (const l of lines) {
      if (!l.account) continue;
      const id = l.account.id;
      if (!map.has(id)) map.set(id, { account: l.account, balance: 0 });
      const r = map.get(id)!;
      // Assets: debit-normal. Liabilities/Equity: credit-normal.
      if (l.account.account_type === "asset") {
        r.balance += Number(l.debit) - Number(l.credit);
      } else {
        r.balance += Number(l.credit) - Number(l.debit);
      }
    }
    const all = Array.from(map.values()).filter(r => r.balance !== 0).sort((a, b) => a.account.code.localeCompare(b.account.code));
    const a = all.filter(r => r.account.account_type === "asset");
    const li = all.filter(r => r.account.account_type === "liability");
    const eq = all.filter(r => r.account.account_type === "equity");
    return {
      assets: a, liabilities: li, equityAccounts: eq,
      totalAssets: a.reduce((s, r) => s + r.balance, 0),
      totalLiabilities: li.reduce((s, r) => s + r.balance, 0),
      totalEquity: eq.reduce((s, r) => s + r.balance, 0),
    };
  }, [lines]);

  const liabAndEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - liabAndEquity) < 0.01;

  const renderSection = (title: string, items: { account: any; balance: number }[], total: number) => (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("accountCode")}</TableHead><TableHead>{t("accountName")}</TableHead><TableHead className="text-right">{t("balance")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? <TableRow><TableCell colSpan={3}>{t("noResults")}</TableCell></TableRow> :
              items.map(r => (
                <TableRow key={r.account.id}>
                  <TableCell className="font-mono">{r.account.code}</TableCell>
                  <TableCell>{r.account.name}</TableCell>
                  <TableCell className="text-right">{r.balance.toLocaleString()}</TableCell>
                </TableRow>
              ))}
          </TableBody>
          <TableFooter><TableRow><TableCell colSpan={2} className="font-bold">{t("total")}</TableCell><TableCell className="text-right font-bold">{total.toLocaleString()}</TableCell></TableRow></TableFooter>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("balanceSheet")}</h1>
        <div className="flex gap-2 print:hidden">
          <ExportButton
            data={[...assets, ...liabilities, ...equityAccounts].map(r => ({
              code: r.account.code,
              name: r.account.name,
              type: r.account.account_type,
              balance: r.balance,
            }))}
            columns={[
              { key: "code", label: t("accountCode") },
              { key: "name", label: t("accountName") },
              { key: "type", label: t("accountType") },
              { key: "balance", label: t("balance"), formatter: (v) => Number(v).toFixed(2) },
            ]}
            filename="balance_sheet"
          />
          <PrintButton />
        </div>
      </div>

      <div className="flex gap-4 print:hidden">
        <div><Label>{t("asOfDate")}</Label><Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} /></div>
      </div>

      {isLoading ? <p>{t("loading")}</p> : (
        <div className="space-y-4">
          {renderSection(t("asset"), assets, totalAssets)}
          {renderSection(t("liability"), liabilities, totalLiabilities)}
          {renderSection(t("equity"), equityAccounts, totalEquity)}

          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <span className="font-bold">{t("asset")} = {t("liability")} + {t("equity")}</span>
              <div className="flex items-center gap-3">
                <span>{totalAssets.toLocaleString()} = {liabAndEquity.toLocaleString()}</span>
                <Badge variant={isBalanced ? "default" : "destructive"}>{isBalanced ? t("balanced") : t("unbalanced")}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
