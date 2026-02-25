import { useParams, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Download, Check, Banknote, CreditCard } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { exportToCsv } from "@/lib/exportCsv";
import { createCodeBasedJournalEntry } from "@/lib/journalUtils";
import { useToast } from "@/hooks/use-toast";

export default function PayrollRunDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ["payroll-run", id],
    queryFn: async () => {
      const { data } = await supabase.from("payroll_runs").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["payroll-run-items", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_items")
        .select("*, employees(full_name, departments(name))")
        .eq("payroll_run_id", id!)
        .order("created_at");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: postingRules = [] } = useQuery({
    queryKey: ["posting_rules_payroll", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("posting_rule_catalog")
        .select("rule_code, debit_account_code, credit_account_code")
        .eq("tenant_id", tenantId!)
        .in("rule_code", ["payroll_gross_exp", "payroll_net_payable", "payroll_tax", "payroll_employee_contrib", "payroll_employer_exp", "payroll_employer_contrib", "payroll_bank"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const getRule = (code: string) => postingRules.find((r: any) => r.rule_code === code);

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!run || !tenantId || !id) throw new Error("Missing data");
      const entryDate = new Date().toISOString().split("T")[0];
      const periodLabel = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;

      if (status === "approved") {
        const rGross = getRule("payroll_gross_exp");
        const rNet = getRule("payroll_net_payable");
        const rTax = getRule("payroll_tax");
        const rEmpContrib = getRule("payroll_employee_contrib");
        const rErExp = getRule("payroll_employer_exp");
        const rErContrib = getRule("payroll_employer_contrib");

        if (!rGross?.debit_account_code || !rNet?.credit_account_code || !rTax?.credit_account_code) {
          throw new Error("Payroll posting rules not configured. Go to Settings → Posting Rules.");
        }

        const totalPioE = items.reduce((s, i: any) => s + Number(i.pension_contribution), 0);
        const totalHealthE = items.reduce((s, i: any) => s + Number(i.health_contribution), 0);
        const totalUnempE = items.reduce((s, i: any) => s + Number(i.unemployment_contribution), 0);
        const totalPioR = items.reduce((s, i: any) => s + Number(i.pension_employer || 0), 0);
        const totalHealthR = items.reduce((s, i: any) => s + Number(i.health_employer || 0), 0);
        const totalEmployeeContrib = totalPioE + totalHealthE + totalUnempE;
        const totalEmployerContrib = totalPioR + totalHealthR;

        const accrualLines: any[] = [
          { accountCode: rGross.debit_account_code, debit: Number(run.total_gross), credit: 0, description: `Troškovi zarada ${periodLabel}`, sortOrder: 0 },
          { accountCode: rNet.credit_account_code, debit: 0, credit: Number(run.total_net), description: `Obaveze za neto zarade ${periodLabel}`, sortOrder: 1 },
          { accountCode: rTax.credit_account_code, debit: 0, credit: Number(run.total_taxes), description: `Obaveze za porez po odbitku ${periodLabel}`, sortOrder: 2 },
        ];
        if (rEmpContrib?.credit_account_code && totalEmployeeContrib > 0) {
          accrualLines.push({ accountCode: rEmpContrib.credit_account_code, debit: 0, credit: totalEmployeeContrib, description: `Obaveze za doprinose radnika ${periodLabel}`, sortOrder: 3 });
        }

        await createCodeBasedJournalEntry({
          tenantId, userId: user?.id || null, entryDate,
          description: `Obračun zarada ${periodLabel}`,
          reference: `PR-${periodLabel}`,
          lines: accrualLines,
        });

        if (totalEmployerContrib > 0 && rErExp?.debit_account_code && rErContrib?.credit_account_code) {
          await createCodeBasedJournalEntry({
            tenantId, userId: user?.id || null, entryDate,
            description: `Doprinosi poslodavca ${periodLabel}`,
            reference: `PR-EC-${periodLabel}`,
            lines: [
              { accountCode: rErExp.debit_account_code, debit: totalEmployerContrib, credit: 0, description: `Troškovi doprinosa na zarade ${periodLabel}`, sortOrder: 0 },
              { accountCode: rErContrib.credit_account_code, debit: 0, credit: totalEmployerContrib, description: `Obaveze za doprinose poslodavca ${periodLabel}`, sortOrder: 1 },
            ],
          });
        }
      } else if (status === "paid") {
        const rBank = getRule("payroll_bank");
        if (!rBank?.debit_account_code || !rBank?.credit_account_code) {
          throw new Error("Payroll bank posting rule not configured.");
        }
        await createCodeBasedJournalEntry({
          tenantId, userId: user?.id || null, entryDate,
          description: `Isplata zarada ${periodLabel}`,
          reference: `PR-PAY-${periodLabel}`,
          lines: [
            { accountCode: rBank.debit_account_code, debit: Number(run.total_net), credit: 0, description: `Isplata neto zarada ${periodLabel}`, sortOrder: 0 },
            { accountCode: rBank.credit_account_code, debit: 0, credit: Number(run.total_net), description: `Tekući račun ${periodLabel}`, sortOrder: 1 },
          ],
        });
      }

      const updates: any = { status };
      if (status === "approved") { updates.approved_by = user?.id; updates.approved_at = new Date().toISOString(); }
      const { error } = await supabase.from("payroll_runs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-run", id] });
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const downloadPppdXml = async () => {
    try {
      toast({ title: t("generatingPppdXml") });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/generate-pppd-xml`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ payroll_run_id: id }) }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `PPP-PD.xml`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  const downloadPaymentOrders = async () => {
    try {
      toast({ title: t("generatingPaymentOrders") });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/generate-payment-orders`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ payroll_run_id: id }) }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `NaloziZaPlacanje.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  const isLoading = runLoading || itemsLoading;
  const monthName = (m: number) => new Date(2024, m - 1).toLocaleString("sr-Latn", { month: "long" });

  const totals = items.reduce(
    (acc, i: any) => ({
      gross: acc.gross + Number(i.gross_salary),
      net: acc.net + Number(i.net_salary),
      tax: acc.tax + Number(i.income_tax),
      pioE: acc.pioE + Number(i.pension_contribution),
      healthE: acc.healthE + Number(i.health_contribution),
      unempE: acc.unempE + Number(i.unemployment_contribution),
      pioR: acc.pioR + Number(i.pension_employer || 0),
      healthR: acc.healthR + Number(i.health_employer || 0),
      meal: acc.meal + Number(i.meal_allowance || 0),
      transport: acc.transport + Number(i.transport_allowance || 0),
      subsidy: acc.subsidy + Number(i.subsidy_amount || 0),
      totalCost: acc.totalCost + Number(i.total_cost),
    }),
    { gross: 0, net: 0, tax: 0, pioE: 0, healthE: 0, unempE: 0, pioR: 0, healthR: 0, meal: 0, transport: 0, subsidy: 0, totalCost: 0 }
  );

  const exportData = items.map((i: any) => ({
    [t("employee")]: i.employees?.full_name || "",
    [t("department")]: i.employees?.departments?.name || "",
    OVP: i.ovp_code || "101",
    [t("grossSalary")]: Number(i.gross_salary),
    "PIO zaposleni": Number(i.pension_contribution),
    "Zdravstvo zaposleni": Number(i.health_contribution),
    [t("incomeTax")]: Number(i.income_tax),
    [t("netSalary")]: Number(i.net_salary),
    "PIO poslodavac": Number(i.pension_employer || 0),
    "Zdravstvo poslodavac": Number(i.health_employer || 0),
    "Topli obrok": Number(i.meal_allowance || 0),
    "Prevoz": Number(i.transport_allowance || 0),
    "Subvencija": Number(i.subsidy_amount || 0),
    [t("totalCost")]: Number(i.total_cost),
  }));

  const statusColor = (s: string) => ({ draft: "secondary", calculated: "default", approved: "default", paid: "default" }[s] || "secondary") as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/hr/payroll">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <PageHeader
          title={run ? `${monthName(run.period_month)} ${run.period_year}` : t("payroll")}
          icon={FileText}
          description={run ? `${t("payroll")} — ${run.status}` : ""}
        />
        {run && <Badge variant={statusColor(run.status)} className="ml-auto text-sm">{run.status}</Badge>}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: t("totalGross"), value: totals.gross },
              { label: t("totalNet"), value: totals.net },
              { label: t("totalTaxes"), value: totals.tax },
              { label: t("pioEmployeeShort"), value: totals.pioE },
              { label: t("pioEmployerShort"), value: totals.pioR },
              { label: t("totalCost"), value: totals.totalCost },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold">{fmtNum(s.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {run?.status === "calculated" && (
              <Button size="sm" onClick={() => statusMutation.mutate("approved")} disabled={statusMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />{t("approvePayroll")}
              </Button>
            )}
            {run?.status === "approved" && (
              <Button size="sm" onClick={() => statusMutation.mutate("paid")} disabled={statusMutation.isPending}>
                <Banknote className="h-4 w-4 mr-2" />{t("markAsPaidPayroll")}
              </Button>
            )}
            {(run?.status === "approved" || run?.status === "paid") && (
              <>
                <Button variant="outline" size="sm" onClick={downloadPppdXml}>
                  <FileText className="h-4 w-4 mr-2" />PPP-PD XML
                </Button>
                <Button variant="outline" size="sm" onClick={downloadPaymentOrders}>
                  <CreditCard className="h-4 w-4 mr-2" />{t("paymentOrders")}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => {
              if (exportData.length === 0) return;
              const cols = Object.keys(exportData[0]).map(k => ({ key: k as any, label: k }));
              exportToCsv(exportData, cols, `payroll-${run?.period_year}-${run?.period_month}`);
            }}>
              <Download className="h-4 w-4 mr-2" />{t("exportCsv")}
            </Button>
          </div>

          {/* Detail table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("employee")}</TableHead>
                    <TableHead>{t("department")}</TableHead>
                    <TableHead>OVP</TableHead>
                    <TableHead className="text-right">{t("grossSalary")}</TableHead>
                     <TableHead className="text-right">{t("pioEmployeeShort")}</TableHead>
                     <TableHead className="text-right">{t("healthShort")}</TableHead>
                     <TableHead className="text-right">{t("incomeTax")}</TableHead>
                     <TableHead className="text-right">{t("netSalary")}</TableHead>
                     <TableHead className="text-right">{t("pioEmployerShort")}</TableHead>
                     <TableHead className="text-right">{t("healthEmployerShort")}</TableHead>
                     <TableHead className="text-right">{t("subsidyAmount")}</TableHead>
                    <TableHead className="text-right">{t("totalCost")}</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.employees?.full_name}</TableCell>
                      <TableCell>{item.employees?.departments?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{item.ovp_code || "101"}</Badge></TableCell>
                      <TableCell className="text-right">{fmtNum(Number(item.gross_salary))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(item.pension_contribution))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(item.health_contribution))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(item.income_tax))}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtNum(Number(item.net_salary))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(item.pension_employer || 0))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(item.health_employer || 0))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(item.subsidy_amount || 0))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(item.total_cost))}</TableCell>
                      <TableCell className="text-right">
                        <DownloadPdfButton type="payslip" params={{ payroll_item_id: item.id }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3}>{t("total")}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.gross)}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.pioE)}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.healthE)}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.tax)}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.net)}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.pioR)}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.healthR)}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.subsidy)}</TableCell>
                    <TableCell className="text-right">{fmtNum(totals.totalCost)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
