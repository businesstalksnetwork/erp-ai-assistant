import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Calculator, Trash2, Pencil } from "lucide-react";

const OVP_OPTIONS = [
  { code: "301", label: "Autorski - 50% troškovi, osiguran", norm: 50 },
  { code: "302", label: "Autorski - 50% troškovi, neosiguran", norm: 50 },
  { code: "303", label: "Autorski - 43% troškovi, osiguran", norm: 43 },
  { code: "304", label: "Autorski - 43% troškovi, neosiguran", norm: 43 },
  { code: "305", label: "Autorski - 34% troškovi, osiguran", norm: 34 },
  { code: "306", label: "Autorski - 34% troškovi, neosiguran", norm: 34 },
  { code: "401", label: "Kamate", norm: 0 },
  { code: "402", label: "Dividende i učešće u dobiti", norm: 0 },
  { code: "403", label: "Prihod od izdavanja nepokretnosti", norm: 25 },
  { code: "404", label: "Prihod od izdavanja pokretnih stvari", norm: 20 },
  { code: "501", label: "Ugovor o delu - osiguran", norm: 20 },
  { code: "502", label: "Ugovor o delu - neosiguran", norm: 20 },
  { code: "601", label: "Stipendije i nagrade (preko neoporezivog)", norm: 0 },
  { code: "602", label: "Ostali prihodi", norm: 0 },
];

const statusColors: Record<string, string> = {
  draft: "secondary",
  calculated: "default",
  paid: "outline",
  cancelled: "destructive",
};

const emptyForm = {
  recipient_name: "",
  recipient_jmbg: "",
  recipient_pib: "",
  recipient_type_code: "01",
  ovp_code: "301",
  description: "",
  gross_amount: "0",
  normalized_expense_pct: "50",
  income_date: new Date().toISOString().split("T")[0],
  period_year: String(new Date().getFullYear()),
  period_month: String(new Date().getMonth() + 1),
  legal_entity_id: "",
  notes: "",
};

export default function NonEmploymentIncome() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { entities: legalEntities } = useLegalEntities();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["non-employment-income", tenantId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("non_employment_income")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("income_date", { ascending: false }) as any);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        tenant_id: tenantId!,
        recipient_name: form.recipient_name,
        recipient_jmbg: form.recipient_jmbg || null,
        recipient_pib: form.recipient_pib || null,
        recipient_type_code: form.recipient_type_code,
        ovp_code: form.ovp_code,
        description: form.description || null,
        gross_amount: parseFloat(form.gross_amount),
        normalized_expense_pct: parseFloat(form.normalized_expense_pct),
        income_date: form.income_date,
        period_year: parseInt(form.period_year),
        period_month: parseInt(form.period_month),
        legal_entity_id: form.legal_entity_id || null,
        notes: form.notes || null,
        created_by: user?.id || null,
      };
      if (editId) {
        payload.updated_at = new Date().toISOString();
        const { error } = await (supabase.from("non_employment_income").update(payload).eq("id", editId) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("non_employment_income").insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["non-employment-income"] });
      setOpen(false); setEditId(null); setForm(emptyForm);
      toast({ title: t("saved") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const calcMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("calculate_non_employment_income" as any, { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["non-employment-income"] });
      toast({ title: t("calculated") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("non_employment_income").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["non-employment-income"] });
      toast({ title: t("deleted") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openEdit = (rec: any) => {
    setEditId(rec.id);
    setForm({
      recipient_name: rec.recipient_name,
      recipient_jmbg: rec.recipient_jmbg || "",
      recipient_pib: rec.recipient_pib || "",
      recipient_type_code: rec.recipient_type_code || "01",
      ovp_code: rec.ovp_code,
      description: rec.description || "",
      gross_amount: String(rec.gross_amount),
      normalized_expense_pct: String(rec.normalized_expense_pct),
      income_date: rec.income_date,
      period_year: String(rec.period_year),
      period_month: String(rec.period_month),
      legal_entity_id: rec.legal_entity_id || "",
      notes: rec.notes || "",
    });
    setOpen(true);
  };

  const fmtAmt = (v: number) => Number(v).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nonEmploymentIncome")}
        icon={FileText}
        description={t("nonEmploymentIncomeDesc")}
        actions={
          <Button onClick={() => { setEditId(null); setForm(emptyForm); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("newIncome")}
          </Button>
        }
      />

      {isLoading ? <Skeleton className="h-80" /> : records.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {t("noNonEmploymentRecords")}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("recipient")}</TableHead>
                  <TableHead>{t("ovpCode")}</TableHead>
                  <TableHead className="text-right">{t("gross")}</TableHead>
                  <TableHead className="text-right">{t("tax")}</TableHead>
                  <TableHead className="text-right">{t("contrib")}</TableHead>
                  <TableHead className="text-right">{t("net")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec: any) => (
                  <TableRow key={rec.id}>
                    <TableCell className="text-sm">{rec.income_date}</TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">{rec.recipient_name}</TableCell>
                    <TableCell className="font-mono text-xs">{rec.ovp_code}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtAmt(rec.gross_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtAmt(rec.tax_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtAmt(rec.pio_amount + rec.health_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtAmt(rec.net_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[rec.status] as any || "outline"}>
                        {rec.status === "draft" ? t("draft") :
                         rec.status === "calculated" ? t("calculated") :
                         rec.status === "paid" ? t("paid") :
                         t("cancelled")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {rec.status === "draft" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title={t("calculate")}
                            onClick={() => calcMutation.mutate(rec.id)} disabled={calcMutation.isPending}>
                            <Calculator className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(rec)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {rec.status === "draft" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("confirmation")}</AlertDialogTitle>
                                <AlertDialogDescription>{t("confirmDeleteRecord")}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(rec.id)}>{t("delete")}</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditId(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? t("editIncome") : t("newIncome")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">{t("recipientName")}</Label>
                <Input value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">{t("recipientJmbg")}</Label><Input value={form.recipient_jmbg} onChange={e => setForm({ ...form, recipient_jmbg: e.target.value })} /></div>
              <div><Label className="text-xs">{t("recipientPib")}</Label><Input value={form.recipient_pib} onChange={e => setForm({ ...form, recipient_pib: e.target.value })} /></div>
              <div>
                <Label className="text-xs">{t("recipientType")}</Label>
                <Select value={form.recipient_type_code} onValueChange={v => setForm({ ...form, recipient_type_code: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">01 - {t("employeeRecipient")}</SelectItem>
                    <SelectItem value="02">02 - {t("founder")}</SelectItem>
                    <SelectItem value="03">03 - {t("pensioner")}</SelectItem>
                    <SelectItem value="04">04 - {t("uninsured")}</SelectItem>
                    <SelectItem value="05">05 - {t("nonResident")}</SelectItem>
                    <SelectItem value="06">06 - {t("other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("incomeTypeOvp")}</Label>
                <Select value={form.ovp_code} onValueChange={v => {
                  const opt = OVP_OPTIONS.find(o => o.code === v);
                  setForm({ ...form, ovp_code: v, normalized_expense_pct: String(opt?.norm ?? 0) });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OVP_OPTIONS.map(o => (
                      <SelectItem key={o.code} value={o.code}>{o.code} - {o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {legalEntities.length > 0 && (
                <div>
                  <Label className="text-xs">{t("legalEntity")}</Label>
                  <Select value={form.legal_entity_id || "__none__"} onValueChange={v => setForm({ ...form, legal_entity_id: v === "__none__" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {legalEntities.map(le => (
                        <SelectItem key={le.id} value={le.id}>{le.name} ({le.pib})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><Label className="text-xs">{t("grossAmount")}</Label><Input type="number" step="0.01" value={form.gross_amount} onChange={e => setForm({ ...form, gross_amount: e.target.value })} /></div>
              <div><Label className="text-xs">{t("normalizedExpenses")}</Label><Input type="number" step="1" value={form.normalized_expense_pct} onChange={e => setForm({ ...form, normalized_expense_pct: e.target.value })} /></div>
              <div><Label className="text-xs">{t("incomeDate")}</Label><Input type="date" value={form.income_date} onChange={e => setForm({ ...form, income_date: e.target.value })} /></div>
              <div className="flex gap-2">
                <div className="flex-1"><Label className="text-xs">{t("periodMonth")}</Label><Input type="number" min="1" max="12" value={form.period_month} onChange={e => setForm({ ...form, period_month: e.target.value })} /></div>
                <div className="flex-1"><Label className="text-xs">{t("periodYear")}</Label><Input type="number" value={form.period_year} onChange={e => setForm({ ...form, period_year: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("description")}</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t("notes")}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditId(null); }}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.recipient_name || !form.gross_amount}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
