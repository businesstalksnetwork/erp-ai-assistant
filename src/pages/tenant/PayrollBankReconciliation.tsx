import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Banknote, CheckCircle, XCircle, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";

const formatNum = (n: number) =>
  n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayrollBankReconciliation() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState("");

  // Load payroll runs
  const { data: runs = [] } = useQuery({
    queryKey: ["payroll-runs-recon", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_runs")
        .select("id, period_month, period_year, status")
        .eq("tenant_id", tenantId!)
        .in("status", ["approved", "paid"])
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Load payroll items for selected run
  const { data: payrollItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["payroll-items-recon", selectedRunId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_items")
        .select("id, employee_id, net_salary, employees(full_name)")
        .eq("payroll_run_id", selectedRunId)
        .order("created_at");
      return data || [];
    },
    enabled: !!selectedRunId,
  });

  // Load bank statement lines (outgoing, unmatched salary-like)
  const { data: bankLines = [], isLoading: loadingLines } = useQuery({
    queryKey: ["bank-lines-salary", tenantId, selectedRunId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_statement_lines")
        .select("id, partner_name, amount, transaction_date, reference, transaction_type, bank_statements(account_id)")
        .eq("tenant_id", tenantId!)
        .eq("direction", "outgoing")
        .order("transaction_date", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!tenantId && !!selectedRunId,
  });

  // Load existing reconciliation records
  const { data: reconRecords = [] } = useQuery({
    queryKey: ["payroll-recon-records", selectedRunId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("payroll_bank_reconciliation" as any)
        .select("*")
        .eq("payroll_run_id", selectedRunId)
        .eq("tenant_id", tenantId!) as any);
      return data || [];
    },
    enabled: !!selectedRunId && !!tenantId,
  });

  // Auto-match logic
  const autoMatches = useMemo(() => {
    if (!payrollItems.length || !bankLines.length) return [];

    return payrollItems.map((pi: any) => {
      const empName = (pi.employees?.full_name || "").toLowerCase();
      const netSalary = Number(pi.net_salary) || 0;
      const existingRecon = reconRecords.find((r: any) => r.employee_id === pi.employee_id);

      if (existingRecon) {
        return { ...pi, match: existingRecon, status: (existingRecon as any).status };
      }

      // Try to find matching bank line
      const match = bankLines.find((bl: any) => {
        const partnerName = (bl.partner_name || "").toLowerCase();
        const amount = Math.abs(Number(bl.amount));
        const nameMatch = partnerName && empName && (
          partnerName.includes(empName) || empName.includes(partnerName) ||
          levenshteinSimilarity(partnerName, empName) > 0.7
        );
        const amountMatch = Math.abs(amount - netSalary) < 1; // tolerance < 1 RSD
        return nameMatch && amountMatch;
      });

      return {
        ...pi,
        match: match || null,
        status: match ? "suggested" : "unmatched",
      };
    });
  }, [payrollItems, bankLines, reconRecords]);

  const confirmMutation = useMutation({
    mutationFn: async ({ employeeId, payrollRunId, bankLineId, expectedAmount, matchedAmount }: any) => {
      const { error } = await (supabase.from("payroll_bank_reconciliation" as any).insert([{
        tenant_id: tenantId,
        payroll_run_id: payrollRunId,
        bank_statement_line_id: bankLineId,
        employee_id: employeeId,
        expected_amount: expectedAmount,
        matched_amount: matchedAmount,
        status: "matched",
        matched_at: new Date().toISOString(),
      }]) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-recon-records", selectedRunId] });
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmAll = () => {
    const suggested = autoMatches.filter((m: any) => m.status === "suggested" && m.match);
    suggested.forEach((m: any) => {
      confirmMutation.mutate({
        employeeId: m.employee_id,
        payrollRunId: selectedRunId,
        bankLineId: m.match.id,
        expectedAmount: Number(m.net_salary) || 0,
        matchedAmount: Math.abs(Number(m.match.amount)),
      });
    });
  };

  const matchedCount = autoMatches.filter((m: any) => m.status === "matched").length;
  const suggestedCount = autoMatches.filter((m: any) => m.status === "suggested").length;
  const unmatchedCount = autoMatches.filter((m: any) => m.status === "unmatched").length;

  const statusBadge = (status: string) => {
    switch (status) {
      case "matched": return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />{t("matched" as any)}</Badge>;
      case "suggested": return <Badge variant="secondary"><ArrowRightLeft className="h-3 w-3 mr-1" />{t("suggested" as any)}</Badge>;
      default: return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{t("unmatched" as any)}</Badge>;
    }
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-6">
      <PageHeader title={t("payrollBankReconciliation" as any)} icon={Banknote} description={t("payrollBankReconciliationDesc" as any)} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPayrollRun" as any)} />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {months[r.period_month - 1]} {r.period_year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {suggestedCount > 0 && (
              <Button onClick={confirmAll} disabled={confirmMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t("confirmAllSuggested" as any)} ({suggestedCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedRunId && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-primary">{matchedCount}</p>
                <p className="text-sm text-muted-foreground">{t("matched" as any)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-warning">{suggestedCount}</p>
                <p className="text-sm text-muted-foreground">{t("suggested" as any)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-destructive">{unmatchedCount}</p>
                <p className="text-sm text-muted-foreground">{t("unmatched" as any)}</p>
              </CardContent>
            </Card>
          </div>

          {(loadingItems || loadingLines) ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead className="text-right">{t("netSalary" as any)}</TableHead>
                  <TableHead>{t("bankPartner" as any)}</TableHead>
                  <TableHead className="text-right">{t("bankAmount" as any)}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoMatches.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.employees?.full_name || "—"}</TableCell>
                    <TableCell className="text-right">{formatNum(Number(m.net_salary) || 0)}</TableCell>
                    <TableCell>{m.match?.partner_name || "—"}</TableCell>
                    <TableCell className="text-right">
                      {m.match ? formatNum(Math.abs(Number(m.match.amount || m.match.matched_amount))) : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(m.status)}</TableCell>
                    <TableCell className="text-right">
                      {m.status === "suggested" && m.match && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => confirmMutation.mutate({
                            employeeId: m.employee_id,
                            payrollRunId: selectedRunId,
                            bankLineId: m.match.id,
                            expectedAmount: Number(m.net_salary) || 0,
                            matchedAmount: Math.abs(Number(m.match.amount)),
                          })}
                          disabled={confirmMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

// Simple Levenshtein similarity (0-1)
function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - matrix[a.length][b.length] / maxLen;
}
