import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Loader2, Calculator, Check, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { createCodeBasedJournalEntry } from "@/lib/journalUtils";

export default function Payroll() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ period_month: now.getMonth() + 1, period_year: now.getFullYear() });

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["payroll-runs", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const { data: runItems = [] } = useQuery({
    queryKey: ["payroll-items", expandedRun],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_items")
        .select("*, employees(full_name)")
        .eq("payroll_run_id", expandedRun!)
        .order("created_at");
      return data || [];
    },
    enabled: !!expandedRun,
  });

  const createMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from("payroll_runs").insert([{
        tenant_id: tenantId!, period_month: f.period_month, period_year: f.period_year, created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const calculateMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase.rpc("calculate_payroll_for_run", { p_payroll_run_id: runId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); qc.invalidateQueries({ queryKey: ["payroll-items"] }); toast.success(t("payrollCalculated")); },
    onError: (e: Error) => toast.error(e.message),
  });

  // PRC 14.6: Approve → Debit 8000 (Salary Expense) / Credit 2100 (Net Payable) + Credit 4700 (Tax+Contributions)
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const run = runs.find((r: any) => r.id === id);
      if (!run || !tenantId) throw new Error("Missing data");

      const entryDate = new Date().toISOString().split("T")[0];
      const periodLabel = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;

      if (status === "approved") {
        // Fetch items to get employer contributions
        const { data: items } = await supabase.from("payroll_items").select("*").eq("payroll_run_id", id);
        const totalPioE = items?.reduce((s, i) => s + Number(i.pension_contribution), 0) || 0;
        const totalHealthE = items?.reduce((s, i) => s + Number(i.health_contribution), 0) || 0;
        const totalUnempE = items?.reduce((s, i) => s + Number(i.unemployment_contribution), 0) || 0;
        const totalPioR = items?.reduce((s, i) => s + Number(i.pension_employer || 0), 0) || 0;
        const totalHealthR = items?.reduce((s, i) => s + Number(i.health_employer || 0), 0) || 0;

        // Employee accrual: D:5200 Bruto / P:4500 Net / P:4510 Tax / P:4520-4540 contributions
        await createCodeBasedJournalEntry({
          tenantId, userId: user?.id || null, entryDate,
          description: `Payroll ${periodLabel} - Accrual`,
          reference: `PR-${periodLabel}`,
          lines: [
            { accountCode: "5200", debit: Number(run.total_gross), credit: 0, description: `Gross salary ${periodLabel}`, sortOrder: 0 },
            { accountCode: "4500", debit: 0, credit: Number(run.total_net), description: `Net payable ${periodLabel}`, sortOrder: 1 },
            { accountCode: "4510", debit: 0, credit: Number(run.total_taxes), description: `Income tax ${periodLabel}`, sortOrder: 2 },
            { accountCode: "4520", debit: 0, credit: totalPioE, description: `PIO employee ${periodLabel}`, sortOrder: 3 },
            { accountCode: "4530", debit: 0, credit: totalHealthE, description: `Health employee ${periodLabel}`, sortOrder: 4 },
            { accountCode: "4540", debit: 0, credit: totalUnempE, description: `Unemployment employee ${periodLabel}`, sortOrder: 5 },
          ],
        });
        // Employer contributions: D:5201 / P:4521 PIO / P:4531 Health
        if (totalPioR + totalHealthR > 0) {
          await createCodeBasedJournalEntry({
            tenantId, userId: user?.id || null, entryDate,
            description: `Payroll ${periodLabel} - Employer contributions`,
            reference: `PR-EC-${periodLabel}`,
            lines: [
              { accountCode: "5201", debit: totalPioR + totalHealthR, credit: 0, description: `Employer contributions ${periodLabel}`, sortOrder: 0 },
              { accountCode: "4521", debit: 0, credit: totalPioR, description: `PIO employer ${periodLabel}`, sortOrder: 1 },
              { accountCode: "4531", debit: 0, credit: totalHealthR, description: `Health employer ${periodLabel}`, sortOrder: 2 },
            ],
          });
        }
      } else if (status === "paid") {
        // Payment: D:4500 Net / P:2431 Bank
        await createCodeBasedJournalEntry({
          tenantId, userId: user?.id || null, entryDate,
          description: `Payroll ${periodLabel} - Payment`,
          reference: `PR-PAY-${periodLabel}`,
          lines: [
            { accountCode: "4500", debit: Number(run.total_net), credit: 0, description: `Pay employees ${periodLabel}`, sortOrder: 0 },
            { accountCode: "2431", debit: 0, credit: Number(run.total_net), description: `Bank payment ${periodLabel}`, sortOrder: 1 },
          ],
        });
      }

      const updates: any = { status };
      if (status === "approved") { updates.approved_by = user?.id; updates.approved_at = new Date().toISOString(); }
      const { error } = await supabase.from("payroll_runs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast.success(v.status === "approved" ? t("payrollPosted") : t("payrollPaymentPosted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor = (s: string) => ({ draft: "secondary", calculated: "default", approved: "default", paid: "default" }[s] || "secondary") as any;
  const monthName = (m: number) => new Date(2024, m - 1).toLocaleString("en", { month: "long" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("payroll")}</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("createPayrollRun")}</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : runs.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t("noResults")}</CardContent></Card>
      ) : (
        <Accordion type="single" collapsible value={expandedRun || ""} onValueChange={(v) => setExpandedRun(v || null)}>
          {runs.map((run: any) => (
            <AccordionItem key={run.id} value={run.id}>
              <Card className="mb-3">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-4 w-full">
                    <span className="font-semibold">{monthName(run.period_month)} {run.period_year}</span>
                    <Badge variant={statusColor(run.status)}>{run.status === "draft" ? t("draft") : run.status === "calculated" ? t("calculated") : run.status === "approved" ? t("approved") : t("paid")}</Badge>
                    <div className="ml-auto flex items-center gap-2 mr-4 text-sm text-muted-foreground">
                      <span>{t("totalGross")}: {fmtNum(Number(run.total_gross))}</span>
                      <span>|</span>
                      <span>{t("totalNet")}: {fmtNum(Number(run.total_net))}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-6 pb-4">
                    <div className="flex gap-2 mb-4">
                      {run.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => calculateMutation.mutate(run.id)} disabled={calculateMutation.isPending}>
                          <Calculator className="h-4 w-4 mr-2" />{t("calculatePayroll")}
                        </Button>
                      )}
                      {run.status === "calculated" && (
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: run.id, status: "approved" })} disabled={statusMutation.isPending}>
                          <Check className="h-4 w-4 mr-2" />{t("approvePayroll")}
                        </Button>
                      )}
                      {run.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: run.id, status: "paid" })} disabled={statusMutation.isPending}>
                          <Banknote className="h-4 w-4 mr-2" />{t("markAsPaidPayroll")}
                        </Button>
                      )}
                    </div>

                    {expandedRun === run.id && runItems.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("employee")}</TableHead>
                            <TableHead className="text-right">{t("grossSalary")}</TableHead>
                            <TableHead className="text-right">PIO 14%</TableHead>
                            <TableHead className="text-right">Zdrav. 5.15%</TableHead>
                            <TableHead className="text-right">Nezap. 0.75%</TableHead>
                            <TableHead className="text-right">{t("incomeTax")}</TableHead>
                            <TableHead className="text-right">{t("netSalary")}</TableHead>
                            <TableHead className="text-right">PIO posl. 11.5%</TableHead>
                            <TableHead className="text-right">Zdrav. posl. 5.15%</TableHead>
                            <TableHead className="text-right">{t("totalCost")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runItems.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.employees?.full_name}</TableCell>
                              <TableCell className="text-right">{fmtNum(Number(item.gross_salary))}</TableCell>
                              <TableCell className="text-right">{fmtNum(Number(item.pension_contribution))}</TableCell>
                              <TableCell className="text-right">{fmtNum(Number(item.health_contribution))}</TableCell>
                              <TableCell className="text-right">{fmtNum(Number(item.unemployment_contribution))}</TableCell>
                              <TableCell className="text-right">{fmtNum(Number(item.income_tax))}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtNum(Number(item.net_salary))}</TableCell>
                              <TableCell className="text-right">{fmtNum(Number(item.pension_employer || 0))}</TableCell>
                              <TableCell className="text-right">{fmtNum(Number(item.health_employer || 0))}</TableCell>
                              <TableCell className="text-right">{fmtNum(Number(item.total_cost))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : expandedRun === run.id ? (
                      <p className="text-sm text-muted-foreground">{run.status === "draft" ? t("calculatePayroll") + " to see details" : t("noResults")}</p>
                    ) : null}

                    {run.status !== "draft" && (
                      <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                        <div><span className="text-muted-foreground">{t("totalGross")}:</span> <strong>{fmtNum(Number(run.total_gross))}</strong></div>
                        <div><span className="text-muted-foreground">{t("totalTaxes")}:</span> <strong>{fmtNum(Number(run.total_taxes))}</strong></div>
                        <div><span className="text-muted-foreground">{t("totalContributions")}:</span> <strong>{fmtNum(Number(run.total_contributions))}</strong></div>
                        <div><span className="text-muted-foreground">{t("totalNet")}:</span> <strong>{fmtNum(Number(run.total_net))}</strong></div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("createPayrollRun")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("periodMonth")}</Label>
              <Input type="number" min={1} max={12} value={form.period_month} onChange={(e) => setForm({ ...form, period_month: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label>{t("periodYear")}</Label>
              <Input type="number" min={2020} value={form.period_year} onChange={(e) => setForm({ ...form, period_year: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
