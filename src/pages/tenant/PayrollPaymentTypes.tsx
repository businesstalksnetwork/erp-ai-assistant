import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, List, Sparkles, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentType {
  id: string;
  code: string;
  name: string;
  type: string;
  is_hourly: boolean;
  is_benefit: boolean;
  rate_multiplier: number;
  is_nontaxable: boolean;
  is_active: boolean;
  osnovna_tabela: number;
  satnica_tip: string;
  payment_category: string;
  compensation_pct: number;
  surcharge_pct: number;
  gl_debit: string;
  gl_credit: string;
  reduces_regular: boolean;
  includes_hot_meal: boolean;
  is_advance: boolean;
  is_storno: boolean;
}

interface GlOverride {
  id?: string;
  payment_type_id: string;
  legal_entity_id: string;
  gl_debit: string;
  gl_credit: string;
}

const emptyForm = {
  code: "", name: "", type: "zarada",
  is_hourly: false, is_benefit: false,
  rate_multiplier: "1.0", is_nontaxable: false, is_active: true,
  osnovna_tabela: "1", satnica_tip: "K", payment_category: "Z",
  compensation_pct: "0", surcharge_pct: "0",
  gl_debit: "5200", gl_credit: "4500",
  reduces_regular: false, includes_hot_meal: true,
  is_advance: false, is_storno: false,
};

export default function PayrollPaymentTypes() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { entities: legalEntities } = useLegalEntities();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["payroll-payment-types", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_payment_types")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("code");
      return (data || []) as PaymentType[];
    },
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useChartOfAccounts<{ code: string; name: string }>({
    select: "code, name",
    queryKeySuffix: "payroll",
  });

  const { data: glOverrides = [] } = useQuery({
    queryKey: ["pt-gl-overrides", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_pt_gl_overrides")
        .select("*")
        .eq("tenant_id", tenantId!);
      return (data || []) as (GlOverride & { id: string; tenant_id: string })[];
    },
    enabled: !!tenantId,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("seed_payroll_payment_types", { p_tenant_id: tenantId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-payment-types"] }); toast({ title: t("paymentTypesSeeded") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!, code: form.code, name: form.name, type: form.type,
        is_hourly: form.is_hourly, is_benefit: form.is_benefit,
        rate_multiplier: parseFloat(form.rate_multiplier),
        is_nontaxable: form.is_nontaxable, is_active: form.is_active,
        osnovna_tabela: parseInt(form.osnovna_tabela),
        satnica_tip: form.satnica_tip, payment_category: form.payment_category,
        compensation_pct: parseFloat(form.compensation_pct),
        surcharge_pct: parseFloat(form.surcharge_pct),
        gl_debit: form.gl_debit, gl_credit: form.gl_credit,
        reduces_regular: form.reduces_regular, includes_hot_meal: form.includes_hot_meal,
        is_advance: form.is_advance, is_storno: form.is_storno,
      };
      if (editId) {
        const { error } = await supabase.from("payroll_payment_types").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payroll_payment_types").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-payment-types"] });
      setOpen(false); setEditId(null); setForm(emptyForm);
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_payment_types").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-payment-types"] }); toast({ title: t("success") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const saveOverrideMutation = useMutation({
    mutationFn: async (override: GlOverride & { id?: string }) => {
      const payload = {
        tenant_id: tenantId!,
        payment_type_id: override.payment_type_id,
        legal_entity_id: override.legal_entity_id,
        gl_debit: override.gl_debit,
        gl_credit: override.gl_credit,
        updated_at: new Date().toISOString(),
      };
      if (override.id) {
        const { error } = await supabase.from("payroll_pt_gl_overrides").update(payload).eq("id", override.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payroll_pt_gl_overrides").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pt-gl-overrides"] });
      toast({ title: t("glMappingSaved") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openEdit = (pt: PaymentType) => {
    setEditId(pt.id);
    setForm({
      code: pt.code, name: pt.name, type: pt.type,
      is_hourly: pt.is_hourly, is_benefit: pt.is_benefit,
      rate_multiplier: String(pt.rate_multiplier),
      is_nontaxable: pt.is_nontaxable, is_active: pt.is_active,
      osnovna_tabela: String(pt.osnovna_tabela || 1),
      satnica_tip: pt.satnica_tip || "K",
      payment_category: pt.payment_category || "Z",
      compensation_pct: String(pt.compensation_pct || 0),
      surcharge_pct: String(pt.surcharge_pct || 0),
      gl_debit: pt.gl_debit || "5200",
      gl_credit: pt.gl_credit || "4500",
      reduces_regular: pt.reduces_regular ?? false,
      includes_hot_meal: pt.includes_hot_meal ?? true,
      is_advance: pt.is_advance ?? false,
      is_storno: pt.is_storno ?? false,
    });
    setOpen(true);
  };

  const categoryLabel = (c: string) => ({
    Z: t("earning"), B: t("sickLeave"),
    N: t("compensation"), A: t("advance"),
    S: t("reversal")
  }[c] || c);

  const categoryColor = (c: string) => ({
    Z: "default", B: "secondary", N: "outline", A: "destructive", S: "destructive"
  }[c] || "outline") as any;

  const AccountSelect = ({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) => (
    <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className={className || "w-[160px] h-8 text-xs"}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const getOverride = (ptId: string, leId: string) =>
    glOverrides.find((o: any) => o.payment_type_id === ptId && o.legal_entity_id === leId);

  const colSpan = 10;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("payrollPaymentTypes")}
        icon={List}
        description={t("paymentTypesDesc")}
        actions={
          <div className="flex gap-2">
            {types.length === 0 && (
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <Sparkles className="h-4 w-4 mr-2" />{t("seedDefaults")}
              </Button>
            )}
            <Button onClick={() => { setEditId(null); setForm(emptyForm); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("newType")}
            </Button>
          </div>
        }
      />

      {isLoading ? <Skeleton className="h-80" /> : types.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {t("noPaymentTypes")}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t("code")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("paymentCategory")}</TableHead>
                  <TableHead className="text-center">{t("baseTable")}</TableHead>
                  <TableHead className="text-right">{t("compensationPct")}</TableHead>
                  <TableHead className="text-right">{t("surchargePct")}</TableHead>
                  <TableHead>{t("glDebitDefault")}</TableHead>
                  <TableHead>{t("glCreditDefault")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((pt) => {
                  const isExpanded = expandedRow === pt.id;
                  const entityOverrides = legalEntities || [];
                  return (
                    <>
                      <TableRow
                        key={pt.id}
                        className={`${!pt.is_active ? "opacity-50" : ""} cursor-pointer hover:bg-muted/50`}
                        onClick={() => setExpandedRow(isExpanded ? null : pt.id)}
                      >
                        <TableCell className="w-8 px-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-mono font-semibold">{pt.code}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{pt.name}</TableCell>
                        <TableCell><Badge variant={categoryColor(pt.payment_category)}>{categoryLabel(pt.payment_category)}</Badge></TableCell>
                        <TableCell className="text-center">{pt.osnovna_tabela}</TableCell>
                        <TableCell className="text-right tabular-nums">{pt.compensation_pct > 0 ? `${pt.compensation_pct}%` : ""}</TableCell>
                        <TableCell className="text-right tabular-nums">{pt.surcharge_pct > 0 ? `${pt.surcharge_pct}%` : ""}</TableCell>
                        <TableCell className="font-mono text-xs">{pt.gl_debit}</TableCell>
                        <TableCell className="font-mono text-xs">{pt.gl_credit}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(pt)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(pt.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${pt.id}-expanded`}>
                          <TableCell colSpan={colSpan} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Building2 className="h-4 w-4" />
                                {t("glAccountsPerEntity")}
                              </div>
                              {entityOverrides.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t("noLegalEntities")}</p>
                              ) : (
                                <div className="grid gap-2">
                                  {entityOverrides.map((le: any) => {
                                    const ov = getOverride(pt.id, le.id);
                                    return (
                                      <EntityGlRow
                                        key={le.id}
                                        entityName={le.name}
                                        entityPib={le.pib}
                                        debit={ov?.gl_debit || ""}
                                        credit={ov?.gl_credit || ""}
                                        defaultDebit={pt.gl_debit}
                                        defaultCredit={pt.gl_credit}
                                        accounts={accounts}
                                        t={t}
                                        onSave={(debit, credit) => {
                                          saveOverrideMutation.mutate({
                                            id: ov?.id,
                                            payment_type_id: pt.id,
                                            legal_entity_id: le.id,
                                            gl_debit: debit,
                                            gl_credit: credit,
                                          });
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground italic">
                                {t("defaultGlNote")}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditId(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? t("editPaymentType") : t("newType")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">{t("code")}</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="100" /></div>
              <div className="col-span-2"><Label className="text-xs">{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{t("paymentCategory")}</Label>
                <Select value={form.payment_category} onValueChange={v => setForm({ ...form, payment_category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Z">{t("earning")}</SelectItem>
                    <SelectItem value="B">{t("sickLeave")}</SelectItem>
                    <SelectItem value="N">{t("compensation")}</SelectItem>
                    <SelectItem value="A">{t("advance")}</SelectItem>
                    <SelectItem value="S">{t("reversal")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("baseTable")}</Label>
                <Select value={form.osnovna_tabela} onValueChange={v => setForm({ ...form, osnovna_tabela: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - {t("employer")}</SelectItem>
                    <SelectItem value="2">2 - {t("healthFund")}</SelectItem>
                    <SelectItem value="3">3 - {t("maternityBase")}</SelectItem>
                    <SelectItem value="4">4 - {t("disabilityBase")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("rateType")}</Label>
                <Select value={form.satnica_tip} onValueChange={v => setForm({ ...form, satnica_tip: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K">{t("hourlyRate2")}</SelectItem>
                    <SelectItem value="N">{t("monthlyRate2")}</SelectItem>
                    <SelectItem value="P">{t("averageRate")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><Label className="text-xs">{t("compensationPct")}</Label><Input type="number" step="1" value={form.compensation_pct} onChange={e => setForm({ ...form, compensation_pct: e.target.value })} /></div>
              <div><Label className="text-xs">{t("surchargePct")}</Label><Input type="number" step="1" value={form.surcharge_pct} onChange={e => setForm({ ...form, surcharge_pct: e.target.value })} /></div>
              <div>
                <Label className="text-xs">{t("glDebitDefault")}</Label>
                <AccountSelect value={form.gl_debit} onChange={v => setForm({ ...form, gl_debit: v })} />
              </div>
              <div>
                <Label className="text-xs">{t("glCreditDefault")}</Label>
                <AccountSelect value={form.gl_credit} onChange={v => setForm({ ...form, gl_credit: v })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_nontaxable} onCheckedChange={v => setForm({ ...form, is_nontaxable: v })} />{t("nontaxable")}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.reduces_regular} onCheckedChange={v => setForm({ ...form, reduces_regular: v })} />{t("reducesRegular")}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.includes_hot_meal} onCheckedChange={v => setForm({ ...form, includes_hot_meal: v })} />{t("hotMeal")}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_benefit} onCheckedChange={v => setForm({ ...form, is_benefit: v })} />{t("benefit")}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />{t("active")}</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditId(null); }}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code || !form.name}>
              {t("save")}
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
    </div>
  );
}

/** Inline row for a single legal entity's GL override */
function EntityGlRow({ entityName, entityPib, debit, credit, defaultDebit, defaultCredit, accounts, t, onSave }: {
  entityName: string;
  entityPib?: string;
  debit: string;
  credit: string;
  defaultDebit: string;
  defaultCredit: string;
  accounts: { code: string; name: string }[];
  t: (key: any) => string;
  onSave: (debit: string, credit: string) => void;
}) {
  const [localDebit, setLocalDebit] = useState(debit);
  const [localCredit, setLocalCredit] = useState(credit);
  const isDirty = localDebit !== debit || localCredit !== credit;
  const hasOverride = !!debit || !!credit;

  return (
    <div className="flex items-center gap-3 flex-wrap bg-background rounded-md border p-2">
      <div className="flex items-center gap-2 min-w-[180px]">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{entityName}</span>
        {entityPib && <span className="text-xs text-muted-foreground">({entityPib})</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("debit")}:</span>
        <Select value={localDebit || "__none__"} onValueChange={v => setLocalDebit(v === "__none__" ? "" : v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("defaultLabel")} ({defaultDebit})</SelectItem>
            {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("credit")}:</span>
        <Select value={localCredit || "__none__"} onValueChange={v => setLocalCredit(v === "__none__" ? "" : v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("defaultLabel")} ({defaultCredit})</SelectItem>
            {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isDirty && (
        <Button size="sm" className="h-7 text-xs" onClick={() => onSave(localDebit, localCredit)}>
          {t("save")}
        </Button>
      )}
      {hasOverride && !isDirty && (
        <Badge variant="outline" className="text-xs">{t("customOverride")}</Badge>
      )}
    </div>
  );
}
