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
import { Plus, Loader2, Calculator, Check, Banknote, Settings, FileText, CreditCard, List, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { fmtNum } from "@/lib/utils";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { PageHeader } from "@/components/shared/PageHeader";

export default function Payroll() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
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

  // GL posting uses configurable posting rules from posting_rule_catalog (legacy)
  // TODO: Migrate to new posting_rules engine with SALARY_PAYMENT / TAX_PAYMENT models
  // when all tenants have seeded default rules via seed_default_posting_rules()
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
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const run = runs.find((r: any) => r.id === id);
      if (!run || !tenantId) throw new Error("Missing data");

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

        const { data: items } = await supabase.from("payroll_items").select("*").eq("payroll_run_id", id);
        const totalPioE = items?.reduce((s, i) => s + Number(i.pension_contribution), 0) || 0;
        const totalHealthE = items?.reduce((s, i) => s + Number(i.health_contribution), 0) || 0;
        const totalUnempE = items?.reduce((s, i) => s + Number(i.unemployment_contribution), 0) || 0;
        const totalPioR = items?.reduce((s, i) => s + Number(i.employer_pio || i.pension_employer || 0), 0) || 0;
        const totalHealthR = items?.reduce((s, i) => s + Number(i.employer_health || i.health_employer || 0), 0) || 0;
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

        await postWithRuleOrFallback({
          tenantId: tenantId!, userId: user?.id || null, entryDate,
          modelCode: "PAYROLL_NET", amount: Number(run.total_gross),
          description: `Obračun zarada ${periodLabel}`,
          reference: `PR-${periodLabel}`,
          context: {},
          fallbackLines: accrualLines,
        });

        if (totalEmployerContrib > 0 && rErExp?.debit_account_code && rErContrib?.credit_account_code) {
          await postWithRuleOrFallback({
            tenantId: tenantId!, userId: user?.id || null, entryDate,
            modelCode: "PAYROLL_TAX", amount: totalEmployerContrib,
            description: `Doprinosi poslodavca ${periodLabel}`,
            reference: `PR-EC-${periodLabel}`,
            context: {},
            fallbackLines: [
              { accountCode: rErExp.debit_account_code, debit: totalEmployerContrib, credit: 0, description: `Troškovi doprinosa na zarade ${periodLabel}`, sortOrder: 0 },
              { accountCode: rErContrib.credit_account_code, debit: 0, credit: totalEmployerContrib, description: `Obaveze za doprinose poslodavca ${periodLabel}`, sortOrder: 1 },
            ],
          });
        }
      } else if (status === "paid") {
        const rBank = getRule("payroll_bank");
        const rNet = getRule("payroll_net_payable");
        if (!rBank?.debit_account_code || !rBank?.credit_account_code) {
          throw new Error("Payroll bank posting rule not configured. Go to Settings → Posting Rules.");
        }
        await postWithRuleOrFallback({
          tenantId: tenantId!, userId: user?.id || null, entryDate,
          modelCode: "PAYROLL_NET", amount: Number(run.total_net),
          description: `Isplata zarada ${periodLabel}`,
          reference: `PR-PAY-${periodLabel}`,
          context: {},
          fallbackLines: [
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
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: v.status === "approved" ? t("payrollPosted") : t("payrollPaymentPosted") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const statusColor = (s: string) => ({ draft: "secondary", calculated: "default", approved: "default", paid: "default" }[s] || "secondary") as any;
  const monthName = (m: number) => new Date(2024, m - 1).toLocaleString("en", { month: "long" });

  const downloadPppdXml = async (runId: string) => {
    try {
      toast({ title: t("generatingPppdXml") });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/generate-pppd-xml`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ payroll_run_id: runId }) }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `PPP-PD.xml`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  const downloadPaymentOrders = async (runId: string) => {
    try {
      toast({ title: t("generatingPaymentOrders") });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/generate-payment-orders`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ payroll_run_id: runId }) }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `NaloziZaPlacanje.csv`; a.click();
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
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: run.id, status: "approved" })} disabled={statusMutation.isPending}>
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
