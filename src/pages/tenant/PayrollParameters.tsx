import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, Plus, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PayrollParams {
  id: string;
  effective_from: string;
  tax_rate: number;
  nontaxable_amount: number;
  pio_employee_rate: number;
  pio_employer_rate: number;
  health_employee_rate: number;
  health_employer_rate: number;
  unemployment_employee_rate: number;
  min_contribution_base: number;
  max_contribution_base: number;
}

export default function PayrollParameters() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    effective_from: new Date().toISOString().split("T")[0],
    tax_rate: "10",
    nontaxable_amount: "28423",
    pio_employee_rate: "14",
    pio_employer_rate: "11",
    health_employee_rate: "5.15",
    health_employer_rate: "5.15",
    unemployment_employee_rate: "0.75",
    min_contribution_base: "45950",
    max_contribution_base: "656425",
  });

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
      const { error } = await supabase.from("payroll_parameters").insert({
        tenant_id: tenantId!,
        effective_from: form.effective_from,
        tax_rate: parseFloat(form.tax_rate) / 100,
        nontaxable_amount: parseFloat(form.nontaxable_amount),
        pio_employee_rate: parseFloat(form.pio_employee_rate) / 100,
        pio_employer_rate: parseFloat(form.pio_employer_rate) / 100,
        health_employee_rate: parseFloat(form.health_employee_rate) / 100,
        health_employer_rate: parseFloat(form.health_employer_rate) / 100,
        unemployment_employee_rate: parseFloat(form.unemployment_employee_rate) / 100,
        min_contribution_base: parseFloat(form.min_contribution_base),
        max_contribution_base: parseFloat(form.max_contribution_base),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("paramsSaved"), description: t("paramsSavedDesc") });
      qc.invalidateQueries({ queryKey: ["payroll-parameters"] });
      setShowForm(false);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const current = params[0];

  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const fmtRSD = (v: number) => `${Number(v).toLocaleString("sr-RS")} RSD`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("payrollParamsTitle")}
        icon={Calculator}
        description={t("payrollParamsDesc")}
      />

      {/* Current effective parameters */}
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
            <CardDescription>{t("validForAllPayrolls")} {format(new Date(current.effective_from), "dd.MM.yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
          </CardContent>
        </Card>
      )}

      {/* Add new parameters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("paramHistory")}</CardTitle>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("newParamSet")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
              <h3 className="font-medium text-sm">{t("addNewParams")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">{t("activeFrom")}</Label>
                  <Input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("payrollTaxRate")}</Label>
                  <Input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("nontaxableAmountLabel")}</Label>
                  <Input type="number" value={form.nontaxable_amount} onChange={e => setForm(f => ({ ...f, nontaxable_amount: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("pioEmployee")}</Label>
                  <Input type="number" step="0.01" value={form.pio_employee_rate} onChange={e => setForm(f => ({ ...f, pio_employee_rate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("pioEmployer")}</Label>
                  <Input type="number" step="0.01" value={form.pio_employer_rate} onChange={e => setForm(f => ({ ...f, pio_employer_rate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("healthEmployee")}</Label>
                  <Input type="number" step="0.01" value={form.health_employee_rate} onChange={e => setForm(f => ({ ...f, health_employee_rate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("healthEmployer")}</Label>
                  <Input type="number" step="0.01" value={form.health_employer_rate} onChange={e => setForm(f => ({ ...f, health_employer_rate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("unemploymentRate")}</Label>
                  <Input type="number" step="0.01" value={form.unemployment_employee_rate} onChange={e => setForm(f => ({ ...f, unemployment_employee_rate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("minBase")}</Label>
                  <Input type="number" value={form.min_contribution_base} onChange={e => setForm(f => ({ ...f, min_contribution_base: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("maxBase")}</Label>
                  <Input type="number" value={form.max_contribution_base} onChange={e => setForm(f => ({ ...f, max_contribution_base: e.target.value }))} />
                </div>
              </div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("activeFrom")}</TableHead>
                  <TableHead>{t("payrollTaxRate")}</TableHead>
                  <TableHead>{t("nontaxableAmountLabel")}</TableHead>
                  <TableHead>{t("pioEmployee")}</TableHead>
                  <TableHead>{t("pioEmployer")}</TableHead>
                  <TableHead>{t("healthEmployee")}</TableHead>
                  <TableHead>{t("healthEmployer")}</TableHead>
                  <TableHead>{t("minBase")}</TableHead>
                  <TableHead>{t("maxBase")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {params.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{format(new Date(p.effective_from), "dd.MM.yyyy")}</TableCell>
                    <TableCell>{fmtPct(p.tax_rate)}</TableCell>
                    <TableCell className="tabular-nums">{fmtRSD(p.nontaxable_amount)}</TableCell>
                    <TableCell>{fmtPct(p.pio_employee_rate)}</TableCell>
                    <TableCell>{fmtPct(p.pio_employer_rate)}</TableCell>
                    <TableCell>{fmtPct(p.health_employee_rate)}</TableCell>
                    <TableCell>{fmtPct(p.health_employer_rate)}</TableCell>
                    <TableCell className="tabular-nums">{fmtRSD(p.min_contribution_base)}</TableCell>
                    <TableCell className="tabular-nums">{fmtRSD(p.max_contribution_base)}</TableCell>
                    <TableCell>
                      {i === 0 && <Badge variant="default">{t("activeParam")}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
