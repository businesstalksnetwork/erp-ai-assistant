import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { PrintButton } from "@/components/PrintButton";

export default function TrialBalance() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["trial_balance", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("journal_lines")
        .select(`
          debit, credit,
          account:chart_of_accounts(id, code, name, name_sr, account_type),
          journal_entry:journal_entries!inner(status, entry_date, tenant_id)
        `)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId);

      if (dateFrom) query = query.gte("journal_entry.entry_date", dateFrom);
      if (dateTo) query = query.lte("journal_entry.entry_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const rows = useMemo(() => {
    const map = new Map<string, { account: any; debit: number; credit: number }>();
    for (const l of lines) {
      if (!l.account) continue;
      const id = l.account.id;
      if (!map.has(id)) map.set(id, { account: l.account, debit: 0, credit: 0 });
      const r = map.get(id)!;
      r.debit += Number(l.debit);
      r.credit += Number(l.credit);
    }
    return Array.from(map.values())
      .filter(r => r.debit !== 0 || r.credit !== 0)
      .sort((a, b) => a.account.code.localeCompare(b.account.code));
  }, [lines]);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("trialBalance")}</h1>
        <div className="flex gap-2 print:hidden">
          <ExportButton
            data={rows.map(r => ({
              code: r.account.code,
              name: r.account.name,
              type: r.account.account_type,
              debit: r.debit,
              credit: r.credit,
              balance: r.debit - r.credit,
            }))}
            columns={[
              { key: "code", label: t("accountCode") },
              { key: "name", label: t("accountName") },
              { key: "type", label: t("accountType") },
              { key: "debit", label: t("debit"), formatter: (v) => Number(v).toFixed(2) },
              { key: "credit", label: t("credit"), formatter: (v) => Number(v).toFixed(2) },
              { key: "balance", label: t("balance"), formatter: (v) => Number(v).toFixed(2) },
            ]}
            filename="trial_balance"
          />
          <PrintButton />
        </div>
      </div>

      <div className="flex gap-4 print:hidden">
        <div><Label>{t("startDate")}</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div><Label>{t("endDate")}</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accountCode")}</TableHead>
                <TableHead>{t("accountName")}</TableHead>
                <TableHead>{t("accountType")}</TableHead>
                <TableHead className="text-right">{t("debit")}</TableHead>
                <TableHead className="text-right">{t("credit")}</TableHead>
                <TableHead className="text-right">{t("balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6}>{t("noResults")}</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.account.id}>
                  <TableCell className="font-mono">{r.account.code}</TableCell>
                  <TableCell>{r.account.name}</TableCell>
                  <TableCell>{t(r.account.account_type === "revenue" ? "revenueType" : r.account.account_type === "expense" ? "expenseType" : r.account.account_type)}</TableCell>
                  <TableCell className="text-right">{r.debit.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.credit.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{(r.debit - r.credit).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-bold">{t("total")}</TableCell>
                <TableCell className="text-right font-bold">{totalDebit.toLocaleString()}</TableCell>
                <TableCell className="text-right font-bold">{totalCredit.toLocaleString()}</TableCell>
                <TableCell className="text-right font-bold">{(totalDebit - totalCredit).toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
