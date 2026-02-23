import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Lock, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

export default function YearEndClosing() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [legalEntityFilter, setLegalEntityFilter] = useState<string>("all");
  const { entities: legalEntities } = useLegalEntities();

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["fiscal-periods", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("fiscal_periods")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  // Preview: calculate revenue/expense totals for selected period
  const { data: preview } = useQuery({
    queryKey: ["year-end-preview", tenantId, selectedPeriodId],
    queryFn: async () => {
      if (!tenantId || !selectedPeriod) return null;

      // Single query with !inner JOINs — no .in() with ID arrays
      const { data: lines } = await supabase
        .from("journal_lines")
        .select(`
          account_id, debit, credit,
          account:chart_of_accounts!inner(id, code, name, account_type),
          journal_entry:journal_entries!inner(tenant_id, status, entry_date)
        `)
        .eq("journal_entry.tenant_id", tenantId)
        .eq("journal_entry.status", "posted")
        .in("account.account_type", ["revenue", "expense"])
        .gte("journal_entry.entry_date", selectedPeriod.start_date)
        .lte("journal_entry.entry_date", selectedPeriod.end_date);

      // Aggregate by account
      const balanceMap: Record<string, { code: string; name: string; account_type: string; balance: number }> = {};
      for (const l of (lines || []) as any[]) {
        const acct = l.account;
        const key = acct.id;
        if (!balanceMap[key]) {
          balanceMap[key] = { code: acct.code, name: acct.name, account_type: acct.account_type, balance: 0 };
        }
        balanceMap[key].balance += Number(l.credit) - Number(l.debit);
      }

      const revenueItems = Object.entries(balanceMap)
        .filter(([, a]) => a.account_type === "revenue" && Math.abs(a.balance) > 0.001)
        .map(([id, a]) => ({ id, code: a.code, name: a.name, balance: a.balance }));

      const expenseItems = Object.entries(balanceMap)
        .filter(([, a]) => a.account_type === "expense" && Math.abs(a.balance) > 0.001)
        .map(([id, a]) => ({ id, code: a.code, name: a.name, balance: -a.balance })); // expenses have debit balances

      const revenueTotal = revenueItems.reduce((s, a) => s + a.balance, 0);
      const expenseTotal = expenseItems.reduce((s, a) => s + a.balance, 0);

      const netIncome = revenueTotal - expenseTotal;
      const citAmount = netIncome > 0 ? Math.round(netIncome * 0.15 * 100) / 100 : 0;
      const netIncomeAfterCit = netIncome - citAmount;

      return {
        revenue: revenueItems,
        expense: expenseItems,
        revenueTotal,
        expenseTotal,
        netIncome,
        citAmount,
        netIncomeAfterCit,
      };
    },
    enabled: !!tenantId && !!selectedPeriod,
  });

  const closingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeriodId || !tenantId) throw new Error("Select a period");
      // p_user_id kept for backward compat; server uses auth.uid() internally
      const { data, error } = await supabase.rpc("perform_year_end_closing", {
        p_tenant_id: tenantId,
        p_fiscal_period_id: selectedPeriodId,
        p_user_id: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (journalId) => {
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: t("yearEndClosingSuccess"), description: `Journal entry ID: ${journalId}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const fmt = (n: number) => Number(n).toLocaleString("sr-RS", { minimumFractionDigits: 2 });

  const closablePeriods = periods.filter(p => p.status !== "locked");

  if (isLoading) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("yearEndClosing")}</h1>
        <p className="text-muted-foreground mt-1">{t("yearEndClosingDesc")}</p>
      </div>

      {/* Period selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("selectFiscalPeriod")}</CardTitle>
          <CardDescription>{t("yearEndSelectPeriodDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-1 flex-1 max-w-sm">
              <Label>{t("fiscalPeriods")}</Label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger><SelectValue placeholder={t("selectFiscalPeriod")} /></SelectTrigger>
                <SelectContent>
                  {closablePeriods.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.start_date} — {p.end_date})
                      {p.status === "closed" ? ` [${t("closed")}]` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {legalEntities.length > 1 && (
              <div className="space-y-1 flex-1 max-w-sm">
                <Label>{t("legalEntityScope")}</Label>
                <Select value={legalEntityFilter} onValueChange={setLegalEntityFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allLegalEntities")}</SelectItem>
                    {legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedPeriod?.status === "locked" && (
              <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" />{t("locked")}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && selectedPeriod && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">{t("totalRevenue")}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmt(preview.revenueTotal)} RSD</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">{t("totalExpenses")}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmt(preview.expenseTotal)} RSD</p></CardContent>
            </Card>
           <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t("netIncome")}</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${preview.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(preview.netIncome)} RSD
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CIT Accrual Preview */}
          {preview.citAmount > 0 && (
            <Card className="border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-base">{t("citAccrual")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("account")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead className="text-right">{t("debit")}</TableHead>
                      <TableHead className="text-right">{t("credit")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono">7200</TableCell>
                      <TableCell>{t("citTaxExpense")}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(preview.citAmount)}</TableCell>
                      <TableCell className="text-right">—</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">4810</TableCell>
                      <TableCell>{t("citPayable")}</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right font-mono">{fmt(preview.citAmount)}</TableCell>
                    </TableRow>
                    <TableRow className="font-semibold">
                      <TableCell colSpan={2}>{t("netIncomeAfterCit")}</TableCell>
                      <TableCell colSpan={2} className="text-right font-mono">{fmt(preview.netIncomeAfterCit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-2">{t("citAccrualNote")}</p>
              </CardContent>
            </Card>
          )}

          {/* Revenue accounts */}
          {preview.revenue.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("revenueAccounts")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("account")}</TableHead>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead className="text-right">{t("balance")}</TableHead>
                      <TableHead className="text-right">{t("closingEntry")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.revenue.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(a.balance)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{t("debit")} {fmt(a.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Expense accounts */}
          {preview.expense.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("expenseAccounts")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("account")}</TableHead>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead className="text-right">{t("balance")}</TableHead>
                      <TableHead className="text-right">{t("closingEntry")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.expense.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(a.balance)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{t("credit")} {fmt(a.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Closing action */}
          <Card className="border-amber-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold">{t("yearEndWarning")}</h3>
                  <p className="text-sm text-muted-foreground">{t("yearEndWarningDesc")}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={closingMutation.isPending || selectedPeriod.status === "locked"}>
                      <Lock className="h-4 w-4 mr-2" />
                      {t("performYearEndClosing")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("yearEndClosingConfirm")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("yearEndClosingConfirmDesc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => closingMutation.mutate()}>{t("confirmAndClose")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {selectedPeriod.status === "locked" && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">{t("yearEndAlreadyClosed")}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
