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
import { Plus, Loader2, Calculator, Check, Banknote, Settings, FileText, CreditCard, List, ExternalLink, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { fmtNum } from "@/lib/utils";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { PageHeader } from "@/components/shared/PageHeader";
import PostingPreviewPanel, { type PreviewLine as PostingPreviewLine } from "@/components/accounting/PostingPreviewPanel";

export default function Payroll() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [previewRunId, setPreviewRunId] = useState<string | null>(null);
  const now = new Date();
  const [form, setForm] = useState({ period_month: now.getMonth() + 1, period_year: now.getFullYear() });

  // Fetch active payroll parameters
  const { data: params } = useQuery({
    queryKey: ["payroll-params", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_parameters")
        .select("*")
        .eq("tenant_id", tenantId!)
        .lte("effective_from", new Date().toISOString().split("T")[0])
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

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
        .select("*, employees(full_name, position, departments(name))")
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); setOpen(false); toast({ title: t("success") }); },
    onError: (e: Error) => {
      if (e.message.includes("payroll_runs_tenant_id_period_month_period_year_key")) {
        toast({ title: t("payrollRunAlreadyExists"), variant: "destructive" });
      } else {
        toast({ title: t("error"), description: e.message, variant: "destructive" });
      }
    },
  });

  const calculateMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase.rpc("calculate_payroll_for_run", { p_payroll_run_id: runId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); qc.invalidateQueries({ queryKey: ["payroll-items"] }); toast({ title: t("payrollCalculated") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Standard Serbian payroll account codes (used as fallback when posting rules engine has no rule configured)
  const PAYROLL_ACCOUNTS = {
    gross_exp_dr: "5200",      // Troškovi zarada
    net_payable_cr: "4500",    // Obaveze za neto zarade
    tax_cr: "4510",            // Obaveze za porez po odbitku
    emp_contrib_cr: "4520",    // Obaveze za doprinose radnika
    er_exp_dr: "5210",         // Troškovi doprinosa poslodavca
    er_contrib_cr: "4530",     // Obaveze za doprinose poslodavca
    bank_dr: "4500",           // Razduživanje obaveza za neto zarade
    bank_cr: "2410",           // Tekući račun
  };

  // Build preview lines for a given run
  const buildPreviewLines = (run: any, items: any[]): PostingPreviewLine[] => {
    const periodLabel = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;
    const totalPioE = items.reduce((s: number, i: any) => s + Number(i.pension_contribution), 0);
    const totalHealthE = items.reduce((s: number, i: any) => s + Number(i.health_contribution), 0);
    const totalUnempE = items.reduce((s: number, i: any) => s + Number(i.unemployment_contribution), 0);
    const totalPioR = items.reduce((s: number, i: any) => s + Number(i.pension_employer || i.employer_pio || 0), 0);
    const totalHealthR = items.reduce((s: number, i: any) => s + Number(i.health_employer || i.employer_health || 0), 0);
    const totalEmployeeContrib = totalPioE + totalHealthE + totalUnempE;
    const totalEmployerContrib = totalPioR + totalHealthR;

    const lines: PostingPreviewLine[] = [
      { accountCode: PAYROLL_ACCOUNTS.gross_exp_dr, accountName: `Troškovi zarada`, debit: Number(run.total_gross), credit: 0 },
      { accountCode: PAYROLL_ACCOUNTS.net_payable_cr, accountName: `Obaveze za neto zarade`, debit: 0, credit: Number(run.total_net) },
      { accountCode: PAYROLL_ACCOUNTS.tax_cr, accountName: `Porez po odbitku`, debit: 0, credit: Number(run.total_taxes) },
    ];
    if (totalEmployeeContrib > 0) {
      lines.push({ accountCode: PAYROLL_ACCOUNTS.emp_contrib_cr, accountName: `Doprinosi radnika`, debit: 0, credit: totalEmployeeContrib });
    }
    if (totalEmployerContrib > 0) {
      lines.push({ accountCode: PAYROLL_ACCOUNTS.er_exp_dr, accountName: `Troškovi doprinosa poslodavca`, debit: totalEmployerContrib, credit: 0 });
      lines.push({ accountCode: PAYROLL_ACCOUNTS.er_contrib_cr, accountName: `Obaveze za doprinose poslodavca`, debit: 0, credit: totalEmployerContrib });
    }

    return lines;
  };

  // Fetch items for preview
  const { data: previewItems = [] } = useQuery({
    queryKey: ["payroll-items-preview", previewRunId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_items")
        .select("pension_contribution, health_contribution, unemployment_contribution, pension_employer, health_employer, employer_pio, employer_health")
        .eq("payroll_run_id", previewRunId!);
      return data || [];
    },
    enabled: !!previewRunId,
  });

  const previewRun = runs.find((r: any) => r.id === previewRunId);
  const previewLines = previewRun && previewItems.length > 0 ? buildPreviewLines(previewRun, previewItems) : [];

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const run = runs.find((r: any) => r.id === id);
      if (!run || !tenantId) throw new Error("Missing data");

      const entryDate = new Date().toISOString().split("T")[0];
      const periodLabel = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;

      if (status === "approved") {
        const { data: items } = await supabase.from("payroll_items").select("*").eq("payroll_run_id", id);
        const totalPioE = items?.reduce((s, i) => s + Number(i.pension_contribution), 0) || 0;
        const totalHealthE = items?.reduce((s, i) => s + Number(i.health_contribution), 0) || 0;
        const totalUnempE = items?.reduce((s, i) => s + Number(i.unemployment_contribution), 0) || 0;
        const totalPioR = items?.reduce((s, i) => s + Number(i.employer_pio || i.pension_employer || 0), 0) || 0;
        const totalHealthR = items?.reduce((s, i) => s + Number(i.employer_health || i.health_employer || 0), 0) || 0;
        const totalEmployeeContrib = totalPioE + totalHealthE + totalUnempE;
        const totalEmployerContrib = totalPioR + totalHealthR;

        const accrualLines: any[] = [
          { accountCode: PAYROLL_ACCOUNTS.gross_exp_dr, debit: Number(run.total_gross), credit: 0, description: `Troškovi zarada ${periodLabel}`, sortOrder: 0 },
          { accountCode: PAYROLL_ACCOUNTS.net_payable_cr, debit: 0, credit: Number(run.total_net), description: `Obaveze za neto zarade ${periodLabel}`, sortOrder: 1 },
          { accountCode: PAYROLL_ACCOUNTS.tax_cr, debit: 0, credit: Number(run.total_taxes), description: `Obaveze za porez po odbitku ${periodLabel}`, sortOrder: 2 },
        ];
        if (totalEmployeeContrib > 0) {
          accrualLines.push({ accountCode: PAYROLL_ACCOUNTS.emp_contrib_cr, debit: 0, credit: totalEmployeeContrib, description: `Obaveze za doprinose radnika ${periodLabel}`, sortOrder: 3 });
        }

        const jeId = await postWithRuleOrFallback({
          tenantId: tenantId!, userId: user?.id || null, entryDate,
          modelCode: "PAYROLL_NET", amount: Number(run.total_gross),
          description: `Obračun zarada ${periodLabel}`,
          reference: `PR-${periodLabel}`,
          legalEntityId: run.legal_entity_id || undefined,
          context: {},
          fallbackLines: accrualLines,
        });

        let erJeId: string | null = null;
        if (totalEmployerContrib > 0) {
          erJeId = await postWithRuleOrFallback({
            tenantId: tenantId!, userId: user?.id || null, entryDate,
            modelCode: "PAYROLL_TAX", amount: totalEmployerContrib,
            description: `Doprinosi poslodavca ${periodLabel}`,
            reference: `PR-EC-${periodLabel}`,
            legalEntityId: run.legal_entity_id || undefined,
            context: {},
            fallbackLines: [
              { accountCode: PAYROLL_ACCOUNTS.er_exp_dr, debit: totalEmployerContrib, credit: 0, description: `Troškovi doprinosa na zarade ${periodLabel}`, sortOrder: 0 },
              { accountCode: PAYROLL_ACCOUNTS.er_contrib_cr, debit: 0, credit: totalEmployerContrib, description: `Obaveze za doprinose poslodavca ${periodLabel}`, sortOrder: 1 },
            ],
          });
        }

        // Save journal entry IDs back to payroll run
        const updates: any = { status, approved_by: user?.id, approved_at: new Date().toISOString() };
        if (jeId) updates.journal_entry_id = jeId;
        if (erJeId) updates.employer_journal_entry_id = erJeId;
        const { error } = await supabase.from("payroll_runs").update(updates).eq("id", id);
        if (error) throw error;

      } else if (status === "paid") {
        const payJeId = await postWithRuleOrFallback({
          tenantId: tenantId!, userId: user?.id || null, entryDate,
          modelCode: "PAYROLL_PAYMENT", amount: Number(run.total_net),
          description: `Isplata zarada ${periodLabel}`,
          reference: `PR-PAY-${periodLabel}`,
          legalEntityId: run.legal_entity_id || undefined,
          context: {},
          fallbackLines: [
            { accountCode: PAYROLL_ACCOUNTS.bank_dr, debit: Number(run.total_net), credit: 0, description: `Isplata neto zarada ${periodLabel}`, sortOrder: 0 },
            { accountCode: PAYROLL_ACCOUNTS.bank_cr, debit: 0, credit: Number(run.total_net), description: `Tekući račun ${periodLabel}`, sortOrder: 1 },
          ],
        });

        const updates: any = { status };
        if (payJeId) updates.payment_journal_entry_id = payJeId;
        const { error } = await supabase.from("payroll_runs").update(updates).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payroll_runs").update({ status } as any).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      setPreviewRunId(null);
      toast({ title: v.status === "approved" ? t("payrollPosted") : t("payrollPaymentPosted") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const statusColor = (s: string): "secondary" | "default" => ({ draft: "secondary" as const, calculated: "default" as const, approved: "default" as const, paid: "default" as const }[s] || "secondary");
  const monthName = (m: number) => new Date(2024, m - 1).toLocaleString("en", { month: "long" });

  const downloadPppdXml = async (runId: string) => {
    try {
      toast({ title: t("generatingPppdXml") });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pppd-xml`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ payroll_run_id: runId }) }
      );
      if (!res.ok) {
        const errText = await res.text();
        let errMsg = "Failed";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch { errMsg = errText; }
        throw new Error(errMsg);
      }
      // P2-06: Response is now raw XML, not JSON-wrapped
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const filename = cd?.match(/filename="?([^"]+)"?/)?.[1] || "PPP-PD.xml";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  const downloadPaymentOrders = async (runId: string) => {
    try {
      toast({ title: t("generatingPaymentOrders") });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-payment-orders`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ payroll_run_id: runId }) }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `NaloziZaPlacanje.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  const downloadTaxPaymentOrders = async (runId: string) => {
    try {
      toast({ title: t("generatingPaymentOrders") });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-tax-payment-orders`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ payroll_run_id: runId }) }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `NaloziPorezi.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("payroll")}
        icon={Banknote}
        actions={
          <div className="flex gap-2">
            <Link to="/hr/payroll/categories">
              <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-2" />{t("categories")}</Button>
            </Link>
            <Link to="/hr/payroll/payment-types">
              <Button variant="outline" size="sm"><List className="h-4 w-4 mr-2" />{t("paymentTypesList")}</Button>
            </Link>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("createPayrollRun")}</Button>
          </div>
        }
      />

      {/* Active Payroll Parameters */}
      {params && (
        <Card>
          <CardContent className="py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t("effectiveFrom")}: <strong>{params.effective_from}</strong></span>
            <span className="text-muted-foreground">{t("nontaxableAmount")}: <strong>{fmtNum(Number(params.nontaxable_amount))} RSD</strong></span>
            <span className="text-muted-foreground">{t("minContributionBase")}: <strong>{fmtNum(Number(params.min_contribution_base))} RSD</strong></span>
            <span className="text-muted-foreground">{t("maxContributionBase")}: <strong>{fmtNum(Number(params.max_contribution_base))} RSD</strong></span>
          </CardContent>
        </Card>
      )}

      {/* AI Anomaly Detection */}
      {tenantId && <AiModuleInsights tenantId={tenantId} module="hr" />}

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
                    <div className="ml-auto flex items-center gap-3 mr-4 text-sm text-muted-foreground">
                      <Badge variant={statusColor(run.status)}>{run.status === "draft" ? t("draft") : run.status === "calculated" ? t("calculated") : run.status === "approved" ? t("approved") : t("paid")}</Badge>
                      <span>{t("totalGross")}: {fmtNum(Number(run.total_gross))}</span>
                      <span>|</span>
                      <span>{t("totalNet")}: {fmtNum(Number(run.total_net))}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-6 pb-4">
                     <div className="flex gap-2 mb-4 flex-wrap">
                       <Link to={`/hr/payroll/${run.id}`}>
                         <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-2" />{t("details")}</Button>
                       </Link>
                      {run.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => calculateMutation.mutate(run.id)} disabled={calculateMutation.isPending}>
                          <Calculator className="h-4 w-4 mr-2" />{t("calculatePayroll")}
                        </Button>
                      )}
                      {run.status === "calculated" && (
                        <Button size="sm" variant="outline" onClick={() => setPreviewRunId(run.id)}>
                          <Check className="h-4 w-4 mr-2" />{t("approvePayroll")}
                        </Button>
                      )}
                       {run.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: run.id, status: "paid" })} disabled={statusMutation.isPending}>
                          <Banknote className="h-4 w-4 mr-2" />{t("markAsPaidPayroll")}
                        </Button>
                      )}
                      {(run.status === "approved" || run.status === "paid") && (
                        <>
                         <Button size="sm" variant="outline" onClick={() => downloadPppdXml(run.id)}>
                             <FileText className="h-4 w-4 mr-2" />PPP-PD XML
                           </Button>
                           <Button size="sm" variant="outline" onClick={() => downloadPaymentOrders(run.id)}>
                             <CreditCard className="h-4 w-4 mr-2" />{t("paymentOrders")}
                           </Button>
                           <Button size="sm" variant="outline" onClick={() => downloadTaxPaymentOrders(run.id)}>
                             <Receipt className="h-4 w-4 mr-2" />{"Nalozi porezi"}
                           </Button>
                        </>
                      )}
                    </div>

                    {expandedRun === run.id && runItems.length > 0 ? (
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                           <TableHead>{t("employee")}</TableHead>
                             <TableHead>{t("department")}</TableHead>
                             <TableHead>OVP</TableHead>
                             <TableHead className="text-right">{t("grossSalary")}</TableHead>
                             <TableHead className="text-right">Minuli rad</TableHead>
                            <TableHead className="text-right">PIO {params ? `${Number(params.pio_employee_rate)}%` : "14%"}</TableHead>
                            <TableHead className="text-right">Zdrav. {params ? `${Number(params.health_employee_rate)}%` : "5.15%"}</TableHead>
                            <TableHead className="text-right">{t("incomeTax")}</TableHead>
                            <TableHead className="text-right">{t("netSalary")}</TableHead>
                              <TableHead className="text-right">{t("pioEmployerShort")}</TableHead>
                              <TableHead className="text-right">{t("healthEmployerShort")}</TableHead>
                              <TableHead className="text-right">{t("subsidyAmount")}</TableHead>
                            <TableHead className="text-right">{t("totalCost")}</TableHead>
                            <TableHead className="text-right">{t("actions")}</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runItems.map((item: any) => (
                            <TableRow key={item.id}>
                               <TableCell>{item.employees?.full_name}</TableCell>
                               <TableCell>{item.employees?.departments?.name || "—"}</TableCell>
                               <TableCell><Badge variant="outline" className="text-xs">{item.ovp_code || "101"}</Badge></TableCell>
                               <TableCell className="text-right">{fmtNum(Number(item.gross_salary))}</TableCell>
                               <TableCell className="text-right text-xs">
                                 {Number(item.minuli_rad_amount || 0) > 0 ? (
                                   <span title={`${Number(item.minuli_rad_years || 0).toFixed(1)} god.`}>
                                     {fmtNum(Number(item.minuli_rad_amount))}
                                   </span>
                                 ) : "—"}
                               </TableCell>
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
                        </TableBody>
                      </Table>
                      </div>
                    ) : expandedRun === run.id ? (
                      <p className="text-sm text-muted-foreground">{run.status === "draft" ? t("calculatePayroll") + " to see details" : t("noResults")}</p>
                    ) : null}

                    {run.status !== "draft" && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
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

      {/* Posting Preview Dialog */}
      <Dialog open={!!previewRunId} onOpenChange={(o) => { if (!o) setPreviewRunId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("approvePayroll")} — {t("glPostingPreview") || "GL Posting Preview"}</DialogTitle>
          </DialogHeader>
          {previewLines.length > 0 ? (
            <PostingPreviewPanel lines={previewLines} />
          ) : (
            <p className="text-sm text-muted-foreground py-4">{t("noResults")} — posting rules may not be configured.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewRunId(null)}>{t("cancel")}</Button>
            <Button
              onClick={() => { if (previewRunId) statusMutation.mutate({ id: previewRunId, status: "approved" }); }}
              disabled={statusMutation.isPending || previewLines.length === 0}
            >
              {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {t("approvePayroll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("createPayrollRun")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
