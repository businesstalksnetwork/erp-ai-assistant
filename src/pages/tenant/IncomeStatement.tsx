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

export default function IncomeStatement() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["income_statement", tenantId, dateFrom, dateTo],
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
        .in("account.account_type", ["revenue", "expense"]);

      if (dateFrom) query = query.gte("journal_entry.entry_date", dateFrom);
      if (dateTo) query = query.lte("journal_entry.entry_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const { revenueAccounts, expenseAccounts, totalRevenue, totalExpenses } = useMemo(() => {
    const map = new Map<string, { account: any; amount: number }>();
    for (const l of lines) {
      if (!l.account) continue;
      const id = l.account.id;
      if (!map.has(id)) map.set(id, { account: l.account, amount: 0 });
      const r = map.get(id)!;
      // Revenue: credits increase, debits decrease. Expense: debits increase, credits decrease.
      if (l.account.account_type === "revenue") {
        r.amount += Number(l.credit) - Number(l.debit);
      } else {
        r.amount += Number(l.debit) - Number(l.credit);
      }
    }
    const all = Array.from(map.values()).sort((a, b) => a.account.code.localeCompare(b.account.code));
    const rev = all.filter(r => r.account.account_type === "revenue");
    const exp = all.filter(r => r.account.account_type === "expense");
    return {
      revenueAccounts: rev,
      expenseAccounts: exp,
      totalRevenue: rev.reduce((s, r) => s + r.amount, 0),
      totalExpenses: exp.reduce((s, r) => s + r.amount, 0),
    };
  }, [lines]);

  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("incomeStatement")}</h1>
        <div className="flex gap-2 print:hidden">
          <ExportButton
            data={[...revenueAccounts, ...expenseAccounts].map(r => ({
              code: r.account.code,
              name: r.account.name,
              type: r.account.account_type,
              amount: r.amount,
            }))}
            columns={[
              { key: "code", label: t("accountCode") },
              { key: "name", label: t("accountName") },
              { key: "type", label: t("accountType") },
              { key: "amount", label: t("amount"), formatter: (v) => Number(v).toFixed(2) },
            ]}
            filename="income_statement"
          />
          <PrintButton />
        </div>
      </div>

      <div className="flex gap-4 print:hidden">
        <div><Label>{t("startDate")}</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div><Label>{t("endDate")}</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>

      {isLoading ? <p>{t("loading")}</p> : (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t("revenueType")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t("accountCode")}</TableHead><TableHead>{t("accountName")}</TableHead><TableHead className="text-right">{t("total")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {revenueAccounts.length === 0 ? <TableRow><TableCell colSpan={3}>{t("noResults")}</TableCell></TableRow> :
                    revenueAccounts.map(r => (
                      <TableRow key={r.account.id}>
                        <TableCell className="font-mono">{r.account.code}</TableCell>
                        <TableCell>{r.account.name}</TableCell>
                        <TableCell className="text-right">{r.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={2} className="font-bold">{t("total")} {t("revenueType")}</TableCell><TableCell className="text-right font-bold">{totalRevenue.toLocaleString()}</TableCell></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("expenseType")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t("accountCode")}</TableHead><TableHead>{t("accountName")}</TableHead><TableHead className="text-right">{t("total")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {expenseAccounts.length === 0 ? <TableRow><TableCell colSpan={3}>{t("noResults")}</TableCell></TableRow> :
                    expenseAccounts.map(r => (
                      <TableRow key={r.account.id}>
                        <TableCell className="font-mono">{r.account.code}</TableCell>
                        <TableCell>{r.account.name}</TableCell>
                        <TableCell className="text-right">{r.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={2} className="font-bold">{t("total")} {t("expenseType")}</TableCell><TableCell className="text-right font-bold">{totalExpenses.toLocaleString()}</TableCell></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <span className="text-xl font-bold">{t("netIncome")}</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{netIncome.toLocaleString()}</span>
                <Badge variant={netIncome >= 0 ? "default" : "destructive"}>{netIncome >= 0 ? t("profit") : t("loss")}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
