import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { BookOpen, Download } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { exportToCsv } from "@/lib/exportCsv";

export default function GeneralLedger() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("all");

  // Fetch partners for filter
  const { data: partners = [] } = useQuery({
    queryKey: ["partners-filter", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name").limit(500);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch cost centers for filter
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers-filter", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers").select("id, code, name").eq("tenant_id", tenantId!).eq("is_active", true).order("code").limit(200);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useChartOfAccounts<{ id: string; code: string; name: string; name_sr: string | null; account_type: string }>({
  });

  // Opening balances: all posted entries BEFORE dateFrom
  const { data: openingData = [] } = useQuery({
    queryKey: ["opening-balances", tenantId, accountFilter, dateFrom],
    queryFn: async () => {
      if (!tenantId || !dateFrom) return [];
      let query = supabase
        .from("journal_lines")
        .select(`debit, credit, account_id, journal_entry:journal_entries!inner(status, entry_date, tenant_id)`)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .lt("journal_entry.entry_date", dateFrom);
      if (accountFilter !== "all") query = query.eq("account_id", accountFilter);
      const { data } = await query;
      return data || [];
    },
    enabled: !!tenantId && !!dateFrom,
  });

  const openingBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of openingData as any[]) {
      const id = line.account_id;
      map.set(id, (map.get(id) || 0) + Number(line.debit) - Number(line.credit));
    }
    return map;
  }, [openingData]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["general_ledger", tenantId, accountFilter, dateFrom, dateTo, partnerFilter, costCenterFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("journal_lines")
        .select(`
          id, debit, credit, description, sort_order, cost_center_id,
          account:chart_of_accounts(id, code, name, name_sr),
          journal_entry:journal_entries!inner(id, entry_number, entry_date, status, description, partner_id)
        `)
        .eq("journal_entry.status", "posted")
        .eq("journal_entry.tenant_id", tenantId)
        .order("sort_order");

      if (accountFilter !== "all") query = query.eq("account_id", accountFilter);
      if (dateFrom) query = query.gte("journal_entry.entry_date", dateFrom);
      if (dateTo) query = query.lte("journal_entry.entry_date", dateTo);
      // CR4-03: Apply partner and cost center filters to query
      if (partnerFilter !== "all") query = query.eq("journal_entry.partner_id", partnerFilter);
      if (costCenterFilter !== "all") query = query.eq("cost_center_id", costCenterFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  // Group by account and compute running balance
  const grouped = useMemo(() => {
    const map = new Map<string, { account: any; lines: any[]; totalDebit: number; totalCredit: number; openingBalance: number }>();
    for (const line of entries) {
      const acc = line.account;
      if (!acc) continue;
      if (!map.has(acc.id)) {
        map.set(acc.id, { account: acc, lines: [], totalDebit: 0, totalCredit: 0, openingBalance: openingBalances.get(acc.id) || 0 });
      }
      const g = map.get(acc.id)!;
      g.lines.push(line);
      g.totalDebit += Number(line.debit);
      g.totalCredit += Number(line.credit);
    }
    return Array.from(map.values())
      .filter(g => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return g.account.code.includes(s) || g.account.name.toLowerCase().includes(s) || (g.account.name_sr || "").toLowerCase().includes(s);
      })
      .sort((a, b) => a.account.code.localeCompare(b.account.code));
  }, [entries, openingBalances, searchTerm]);

  const grandDebit = grouped.reduce((s, g) => s + g.totalDebit, 0);
  const grandCredit = grouped.reduce((s, g) => s + g.totalCredit, 0);

  // Filtered accounts for dropdown
  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts.slice(0, 100);
    const s = searchTerm.toLowerCase();
    return accounts.filter(a => a.code.includes(s) || a.name.toLowerCase().includes(s) || (a.name_sr || "").toLowerCase().includes(s)).slice(0, 100);
  }, [accounts, searchTerm]);

  const handleExportCsv = () => {
    const rows: any[] = [];
    for (const g of grouped) {
      let balance = g.openingBalance;
      if (dateFrom && g.openingBalance !== 0) {
        rows.push({ Konto: g.account.code, Naziv: g.account.name, Datum: "", BrojNaloga: "Početno stanje", Opis: "", Duguje: "", Potražuje: "", Saldo: g.openingBalance });
      }
      for (const line of g.lines) {
        balance += Number(line.debit) - Number(line.credit);
        rows.push({
          Konto: g.account.code, Naziv: g.account.name,
          Datum: line.journal_entry?.entry_date || "", BrojNaloga: line.journal_entry?.entry_number || "",
          Opis: line.description || line.journal_entry?.description || "",
          Duguje: Number(line.debit), Potražuje: Number(line.credit), Saldo: balance,
        });
      }
    }
    const cols = Object.keys(rows[0] || {}).map(k => ({ key: k as any, label: k }));
    exportToCsv(rows, cols, `kartica-konta-${dateFrom || "all"}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Glavna knjiga / Kartica konta" : t("generalLedger")}
        icon={BookOpen}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={grouped.length === 0}>
              <Download className="h-4 w-4 mr-2" />CSV
            </Button>
            {tenantId && (
              <DownloadPdfButton
                type="account_card"
                params={{ tenant_id: tenantId, date_from: dateFrom, date_to: dateTo, account_id: accountFilter !== "all" ? accountFilter : undefined }}
              />
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-4">
        <div className="w-72">
          <Label>{t("search")}</Label>
          <Input placeholder={locale === "sr" ? "Pretraži konto..." : "Search account..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="w-72">
          <Label>{t("account")}</Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === "sr" ? "Svi konti" : t("allStatuses")}</SelectItem>
              {filteredAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.code} — {locale === "sr" ? (a.name_sr || a.name) : a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56">
          <Label>{locale === "sr" ? "Partner" : "Partner"}</Label>
          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === "sr" ? "Svi partneri" : "All partners"}</SelectItem>
              {partners.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label>{locale === "sr" ? "Mesto troška" : "Cost Center"}</Label>
          <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === "sr" ? "Svi" : "All"}</SelectItem>
              {costCenters.map((cc: any) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>
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
        <p className="text-center text-muted-foreground py-8">{t("loading")}</p>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t("noResults")}</CardContent></Card>
      ) : (
        <>
          {grouped.map((g) => {
            let runningBalance = g.openingBalance;
            return (
              <Card key={g.account.id}>
                <CardContent className="p-0">
                  <div className="p-4 border-b bg-muted/50 flex justify-between items-center flex-wrap gap-2">
                    <span className="font-semibold">{g.account.code} — {locale === "sr" ? (g.account.name_sr || g.account.name) : g.account.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {t("totalDebit")}: {fmtNum(g.totalDebit)} | {t("totalCredit")}: {fmtNum(g.totalCredit)} | {locale === "sr" ? "Saldo" : "Balance"}: {fmtNum(g.openingBalance + g.totalDebit - g.totalCredit)}
                    </span>
                  </div>

                  {/* P8-05: T-account visualization */}
                  <div className="p-4 border-b">
                    <div className="border rounded-md overflow-hidden max-w-md mx-auto">
                      <div className="grid grid-cols-2 divide-x">
                        <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-center border-b">{t("debit")}</div>
                        <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-center border-b">{t("credit")}</div>
                      </div>
                      <div className="grid grid-cols-2 divide-x">
                        <div className="px-3 py-2 text-right tabular-nums text-sm font-medium">{fmtNum(g.openingBalance > 0 ? g.openingBalance : 0)}{g.openingBalance > 0 && <span className="text-[10px] text-muted-foreground ml-1">(PS)</span>}<br/>{fmtNum(g.totalDebit)}</div>
                        <div className="px-3 py-2 text-right tabular-nums text-sm font-medium">{fmtNum(g.openingBalance < 0 ? Math.abs(g.openingBalance) : 0)}{g.openingBalance < 0 && <span className="text-[10px] text-muted-foreground ml-1">(PS)</span>}<br/>{fmtNum(g.totalCredit)}</div>
                      </div>
                      <div className="grid grid-cols-2 divide-x border-t bg-muted/30">
                        <div className="px-3 py-1 text-right tabular-nums text-xs font-bold">{fmtNum((g.openingBalance > 0 ? g.openingBalance : 0) + g.totalDebit)}</div>
                        <div className="px-3 py-1 text-right tabular-nums text-xs font-bold">{fmtNum((g.openingBalance < 0 ? Math.abs(g.openingBalance) : 0) + g.totalCredit)}</div>
                      </div>
                      <div className="px-3 py-1.5 text-center text-xs font-semibold border-t bg-muted/50">
                        {locale === "sr" ? "Saldo" : "Balance"}: {fmtNum(g.openingBalance + g.totalDebit - g.totalCredit)}
                      </div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("entryDate")}</TableHead>
                        <TableHead>{t("entryNumber")}</TableHead>
                        <TableHead>{t("description")}</TableHead>
                        <TableHead className="text-right">{t("debit")}</TableHead>
                        <TableHead className="text-right">{t("credit")}</TableHead>
                        <TableHead className="text-right">{locale === "sr" ? "Saldo" : t("balance")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Opening balance row */}
                      {dateFrom && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={3} className="font-medium italic">{locale === "sr" ? "Početno stanje" : "Opening Balance"}</TableCell>
                          <TableCell className="text-right">{g.openingBalance > 0 ? fmtNum(g.openingBalance) : ""}</TableCell>
                          <TableCell className="text-right">{g.openingBalance < 0 ? fmtNum(Math.abs(g.openingBalance)) : ""}</TableCell>
                          <TableCell className="text-right font-medium">{fmtNum(g.openingBalance)}</TableCell>
                        </TableRow>
                      )}
                      {g.lines.map((line: any) => {
                        runningBalance += Number(line.debit) - Number(line.credit);
                        return (
                          <TableRow key={line.id}>
                            <TableCell>{line.journal_entry?.entry_date ? new Date(line.journal_entry.entry_date).toLocaleDateString("sr-Latn-RS") : ""}</TableCell>
                            <TableCell className="font-mono text-xs">{line.journal_entry?.entry_number}</TableCell>
                            <TableCell className="max-w-xs truncate">{line.description || line.journal_entry?.description || ""}</TableCell>
                            <TableCell className="text-right tabular-nums">{Number(line.debit) > 0 ? fmtNum(Number(line.debit)) : ""}</TableCell>
                            <TableCell className="text-right tabular-nums">{Number(line.credit) > 0 ? fmtNum(Number(line.credit)) : ""}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{fmtNum(runningBalance)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3}>{t("total")}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(g.totalDebit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(g.totalCredit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(g.openingBalance + g.totalDebit - g.totalCredit)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardContent className="p-4 flex justify-end gap-8 font-bold">
              <span>{t("totalDebit")}: {fmtNum(grandDebit)}</span>
              <span>{t("totalCredit")}: {fmtNum(grandCredit)}</span>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
