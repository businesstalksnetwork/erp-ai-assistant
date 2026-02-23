import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function GeneralLedger() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart_of_accounts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, name_sr, account_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["general_ledger", tenantId, accountFilter, dateFrom, dateTo],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("journal_lines")
        .select(`
          id, debit, credit, description, sort_order,
          account:chart_of_accounts(id, code, name, name_sr),
          journal_entry:journal_entries!inner(id, entry_number, entry_date, status, description)
        `)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .order("sort_order");

      if (accountFilter !== "all") {
        query = query.eq("account_id", accountFilter);
      }
      if (dateFrom) query = query.gte("journal_entry.entry_date", dateFrom);
      if (dateTo) query = query.lte("journal_entry.entry_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  // Group by account and compute running balance
  const grouped = useMemo(() => {
    const map = new Map<string, { account: any; lines: any[]; totalDebit: number; totalCredit: number }>();
    for (const line of entries) {
      const acc = line.account;
      if (!acc) continue;
      if (!map.has(acc.id)) {
        map.set(acc.id, { account: acc, lines: [], totalDebit: 0, totalCredit: 0 });
      }
      const g = map.get(acc.id)!;
      g.lines.push(line);
      g.totalDebit += Number(line.debit);
      g.totalCredit += Number(line.credit);
    }
    return Array.from(map.values()).sort((a, b) => a.account.code.localeCompare(b.account.code));
  }, [entries]);

  const grandDebit = grouped.reduce((s, g) => s + g.totalDebit, 0);
  const grandCredit = grouped.reduce((s, g) => s + g.totalCredit, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("generalLedger")}</h1>

      <div className="flex flex-wrap gap-4">
        <div className="w-64">
          <Label>{t("account")}</Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("startDate")}</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>{t("endDate")}</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p>{t("loading")}</p>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t("noResults")}</CardContent></Card>
      ) : (
        <>
          {grouped.map((g) => {
            let runningBalance = 0;
            return (
              <Card key={g.account.id}>
                <CardContent className="p-0">
                  <div className="p-4 border-b bg-muted/50 flex justify-between items-center">
                    <span className="font-semibold">{g.account.code} — {g.account.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {t("totalDebit")}: {g.totalDebit.toLocaleString()} | {t("totalCredit")}: {g.totalCredit.toLocaleString()}
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("entryDate")}</TableHead>
                        <TableHead>{t("entryNumber")}</TableHead>
                        <TableHead>{t("description")}</TableHead>
                        <TableHead className="text-right">{t("debit")}</TableHead>
                        <TableHead className="text-right">{t("credit")}</TableHead>
                        <TableHead className="text-right">{t("balance")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.lines.map((line: any) => {
                        runningBalance += Number(line.debit) - Number(line.credit);
                        return (
                          <TableRow key={line.id}>
                            <TableCell>{line.journal_entry?.entry_date ? format(new Date(line.journal_entry.entry_date), "dd.MM.yyyy") : ""}</TableCell>
                            <TableCell>{line.journal_entry?.entry_number}</TableCell>
                            <TableCell>{line.description || line.journal_entry?.description || ""}</TableCell>
                            <TableCell className="text-right">{Number(line.debit) > 0 ? Number(line.debit).toLocaleString() : ""}</TableCell>
                            <TableCell className="text-right">{Number(line.credit) > 0 ? Number(line.credit).toLocaleString() : ""}</TableCell>
                            <TableCell className="text-right font-medium">{runningBalance.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardContent className="p-4 flex justify-end gap-8 font-bold">
              <span>{t("totalDebit")}: {grandDebit.toLocaleString()}</span>
              <span>{t("totalCredit")}: {grandCredit.toLocaleString()}</span>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
