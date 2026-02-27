import { useState, lazy, Suspense } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const PayrollCategoriesContent = lazy(() => import("@/pages/tenant/PayrollCategories"));
const PayrollPaymentTypesContent = lazy(() => import("@/pages/tenant/PayrollPaymentTypes"));
const TabLoading = () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calculator, Plus, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PayrollParams {
  id: string;
  effective_from: string;
  effective_to: string | null;
  tax_rate: number;
  nontaxable_amount: number;
  pio_employee_rate: number;
  pio_employer_rate: number;
  health_employee_rate: number;
  health_employer_rate: number;
  unemployment_employee_rate: number;
  min_contribution_base: number;
  max_contribution_base: number;
  minimum_hourly_wage: number | null;
  meal_allowance_daily: number | null;
  transport_allowance_monthly: number | null;
  overtime_multiplier: number | null;
  night_work_multiplier: number | null;
  gazette_reference: string | null;
}

type FormState = {
  effective_from: string;
  effective_to: string;
  tax_rate: string;
  nontaxable_amount: string;
  pio_employee_rate: string;
  pio_employer_rate: string;
  health_employee_rate: string;
  health_employer_rate: string;
  unemployment_employee_rate: string;
  min_contribution_base: string;
  max_contribution_base: string;
  minimum_hourly_wage: string;
  meal_allowance_daily: string;
  transport_allowance_monthly: string;
  overtime_multiplier: string;
  night_work_multiplier: string;
  gazette_reference: string;
};

const defaultForm: FormState = {
  effective_from: new Date().toISOString().split("T")[0],
  effective_to: "",
  tax_rate: "10",
  nontaxable_amount: "34221",
  pio_employee_rate: "14",
  pio_employer_rate: "12",
  health_employee_rate: "5.15",
  health_employer_rate: "5.15",
  unemployment_employee_rate: "0.75",
  min_contribution_base: "51297",
  max_contribution_base: "732820",
  minimum_hourly_wage: "371",
  meal_allowance_daily: "0",
  transport_allowance_monthly: "0",
  overtime_multiplier: "1.26",
  night_work_multiplier: "0.26",
  gazette_reference: "",
};

function FormFields({ f, setF, t }: {
  f: FormState;
  setF: (fn: (prev: FormState) => FormState) => void;
  t: (key: string) => string;
}) {
  const field = (key: keyof FormState, label: string, type = "number", step = "0.01") => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        step={type === "number" ? step : undefined}
        value={f[key]}
        onChange={e => setF(p => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("period")}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {field("effective_from", t("activeFrom"), "date")}
        {field("effective_to", t("effectiveTo"), "date")}
        <div>
          <Label className="text-xs">{t("gazetteReference")}</Label>
          <Input
            type="text"
            value={f.gazette_reference}
            placeholder="Sl. glasnik RS br. XX/2026"
            onChange={e => setF(p => ({ ...p, gazette_reference: e.target.value }))}
          />
        </div>
      </div>

      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("taxAndContributions")}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {field("tax_rate", t("payrollTaxRate") + " (%)")}
        {field("nontaxable_amount", t("nontaxableAmountLabel") + " (RSD)", "number", "1")}
        {field("pio_employee_rate", t("pioEmployee") + " (%)")}
        {field("pio_employer_rate", t("pioEmployer") + " (%)")}
        {field("health_employee_rate", t("healthEmployee") + " (%)")}
        {field("health_employer_rate", t("healthEmployer") + " (%)")}
        {field("unemployment_employee_rate", t("unemploymentRate") + " (%)")}
      </div>

      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("contributionBases")}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {field("min_contribution_base", t("minBase") + " (RSD)", "number", "1")}
        {field("max_contribution_base", t("maxBase") + " (RSD)", "number", "1")}
      </div>

      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("wagesAndAllowances")}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {field("minimum_hourly_wage", t("minimumHourlyWage") + " (RSD)", "number", "0.01")}
        {field("meal_allowance_daily", t("mealAllowanceDaily") + " (RSD)", "number", "1")}
        {field("transport_allowance_monthly", t("transportAllowanceMonthly") + " (RSD)", "number", "1")}
      </div>

      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("multipliers")}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {field("overtime_multiplier", t("overtimeMultiplier"))}
        {field("night_work_multiplier", t("nightWorkMultiplier"))}
      </div>
    </div>
  );
}

function formToPayload(f: FormState, tenantId: string) {
  return {
    tenant_id: tenantId,
    effective_from: f.effective_from,
    effective_to: f.effective_to || null,
    tax_rate: parseFloat(f.tax_rate) / 100,
    nontaxable_amount: parseFloat(f.nontaxable_amount),
    pio_employee_rate: parseFloat(f.pio_employee_rate) / 100,
    pio_employer_rate: parseFloat(f.pio_employer_rate) / 100,
    health_employee_rate: parseFloat(f.health_employee_rate) / 100,
    health_employer_rate: parseFloat(f.health_employer_rate) / 100,
    unemployment_employee_rate: parseFloat(f.unemployment_employee_rate) / 100,
    min_contribution_base: parseFloat(f.min_contribution_base),
    max_contribution_base: parseFloat(f.max_contribution_base),
    minimum_hourly_wage: parseFloat(f.minimum_hourly_wage) || 0,
    meal_allowance_daily: parseFloat(f.meal_allowance_daily) || 0,
    transport_allowance_monthly: parseFloat(f.transport_allowance_monthly) || 0,
    overtime_multiplier: parseFloat(f.overtime_multiplier) || 1.26,
    night_work_multiplier: parseFloat(f.night_work_multiplier) || 0.26,
    gazette_reference: f.gazette_reference || null,
  };
}

function paramsToForm(p: PayrollParams): FormState {
  return {
    effective_from: p.effective_from,
    effective_to: p.effective_to || "",
    tax_rate: String((p.tax_rate * 100).toFixed(2)),
    nontaxable_amount: String(p.nontaxable_amount),
    pio_employee_rate: String((p.pio_employee_rate * 100).toFixed(2)),
    pio_employer_rate: String((p.pio_employer_rate * 100).toFixed(2)),
    health_employee_rate: String((p.health_employee_rate * 100).toFixed(2)),
    health_employer_rate: String((p.health_employer_rate * 100).toFixed(2)),
    unemployment_employee_rate: String((p.unemployment_employee_rate * 100).toFixed(2)),
    min_contribution_base: String(p.min_contribution_base),
    max_contribution_base: String(p.max_contribution_base),
    minimum_hourly_wage: String(p.minimum_hourly_wage ?? 0),
    meal_allowance_daily: String(p.meal_allowance_daily ?? 0),
    transport_allowance_monthly: String(p.transport_allowance_monthly ?? 0),
    overtime_multiplier: String(p.overtime_multiplier ?? 1.26),
    night_work_multiplier: String(p.night_work_multiplier ?? 0.26),
    gazette_reference: p.gazette_reference || "",
  };
}

export default function PayrollParameters() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "parameters";
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(defaultForm);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: params = [], isLoading } = useQuery({
    queryKey: ["payroll-parameters", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_parameters")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data as PayrollParams[];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = formToPayload(form, tenantId!);
      const { error } = await supabase.from("payroll_parameters").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("paramsSaved"), description: t("paramsSavedDesc") });
      qc.invalidateQueries({ queryKey: ["payroll-parameters"] });
      setShowForm(false);
      setForm(defaultForm);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const { tenant_id, ...payload } = formToPayload(editForm, tenantId!);
      const { error } = await supabase.from("payroll_parameters").update(payload).eq("id", editId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("paramsSaved"), description: t("paramsSavedDesc") });
      qc.invalidateQueries({ queryKey: ["payroll-parameters"] });
      setEditId(null);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_parameters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success"), description: t("paramsSavedDesc") });
      qc.invalidateQueries({ queryKey: ["payroll-parameters"] });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const fmtRSD = (v: number) => `${Number(v).toLocaleString("sr-RS")} RSD`;

  const current = params[0];

  return (
    <div className="space-y-6">
      <PageHeader title={t("payrollParamsTitle")} icon={Calculator} description={t("payrollParamsDesc")} />

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="parameters">{t("payrollParamsTitle")}</TabsTrigger>
          <TabsTrigger value="categories">{t("incomeCategories")}</TabsTrigger>
          <TabsTrigger value="payment-types">{t("payrollPaymentTypes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="parameters">

      {current && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("currentActiveParams")}</CardTitle>
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {t("activeFrom")} {format(new Date(current.effective_from), "dd.MM.yyyy")}
              </Badge>
            </div>
            <CardDescription>
              {current.gazette_reference
                ? `${current.gazette_reference} — ${t("validForAllPayrolls")} ${format(new Date(current.effective_from), "dd.MM.yyyy")}`
                : `${t("validForAllPayrolls")} ${format(new Date(current.effective_from), "dd.MM.yyyy")}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tax & contributions */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: t("payrollTaxRate"), value: fmtPct(current.tax_rate) },
                { label: t("nontaxableAmountLabel"), value: fmtRSD(current.nontaxable_amount) },
                { label: t("pioEmployee"), value: fmtPct(current.pio_employee_rate) },
                { label: t("pioEmployer"), value: fmtPct(current.pio_employer_rate) },
                { label: t("healthEmployee"), value: fmtPct(current.health_employee_rate) },
                { label: t("healthEmployer"), value: fmtPct(current.health_employer_rate) },
                { label: t("unemploymentRate"), value: fmtPct(current.unemployment_employee_rate) },
                { label: t("minBase"), value: fmtRSD(current.min_contribution_base) },
                { label: t("maxBase"), value: fmtRSD(current.max_contribution_base) },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-sm font-semibold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
            {/* Wages & multipliers */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: t("minimumHourlyWage"), value: fmtRSD(current.minimum_hourly_wage ?? 0) },
                { label: t("mealAllowanceDaily"), value: fmtRSD(current.meal_allowance_daily ?? 0) },
                { label: t("transportAllowanceMonthly"), value: fmtRSD(current.transport_allowance_monthly ?? 0) },
                { label: t("overtimeMultiplier"), value: `×${current.overtime_multiplier ?? 1.26}` },
                { label: t("nightWorkMultiplier"), value: `+${((current.night_work_multiplier ?? 0.26) * 100).toFixed(0)}%` },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-sm font-semibold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("paramHistory")}</CardTitle>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />{t("newParamSet")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
              <h3 className="font-medium text-sm">{t("addNewParams")}</h3>
              <FormFields f={form} setF={setForm} t={t} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? t("saving") : t("save")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>{t("cancel")}</Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : params.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noSavedParams")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("activeFrom")}</TableHead>
                    <TableHead>{t("effectiveTo")}</TableHead>
                    <TableHead>{t("payrollTaxRate")}</TableHead>
                    <TableHead>{t("nontaxableAmountLabel")}</TableHead>
                    <TableHead>{t("pioEmployee")}</TableHead>
                    <TableHead>{t("pioEmployer")}</TableHead>
                    <TableHead>{t("healthEmployee")}</TableHead>
                    <TableHead>{t("minBase")}</TableHead>
                    <TableHead>{t("maxBase")}</TableHead>
                    <TableHead>{t("gazetteReference")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {params.map((p, i) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{format(new Date(p.effective_from), "dd.MM.yyyy")}</TableCell>
                      <TableCell>{p.effective_to ? format(new Date(p.effective_to), "dd.MM.yyyy") : "—"}</TableCell>
                      <TableCell>{fmtPct(p.tax_rate)}</TableCell>
                      <TableCell className="tabular-nums">{fmtRSD(p.nontaxable_amount)}</TableCell>
                      <TableCell>{fmtPct(p.pio_employee_rate)}</TableCell>
                      <TableCell>{fmtPct(p.pio_employer_rate)}</TableCell>
                      <TableCell>{fmtPct(p.health_employee_rate)}</TableCell>
                      <TableCell className="tabular-nums">{fmtRSD(p.min_contribution_base)}</TableCell>
                      <TableCell className="tabular-nums">{fmtRSD(p.max_contribution_base)}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{p.gazette_reference || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {i === 0 && <Badge variant="default">{t("activeParam")}</Badge>}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditForm(paramsToForm(p)); setEditId(p.id); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {i !== 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
          </DialogHeader>
          <FormFields f={editForm} setF={setEditForm} t={t} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>{t("cancel")}</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              {editMutation.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>

        <TabsContent value="categories">
          <Suspense fallback={<TabLoading />}><PayrollCategoriesContent /></Suspense>
        </TabsContent>
        <TabsContent value="payment-types">
          <Suspense fallback={<TabLoading />}><PayrollPaymentTypesContent /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
