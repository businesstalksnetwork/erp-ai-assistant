import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { BulkEntitlementGenerator } from "@/components/hr/BulkEntitlementGenerator";

interface PolicyForm {
  name: string;
  leave_type: string;
  annual_entitlement: string;
  max_carryover: string;
  accrual_method: string;
  requires_approval: boolean;
  min_days_advance: string;
  max_consecutive_days: string;
  probation_months: string;
  is_active: boolean;
}

const emptyForm: PolicyForm = {
  name: "", leave_type: "vacation", annual_entitlement: "20", max_carryover: "5",
  accrual_method: "annual", requires_approval: true, min_days_advance: "3",
  max_consecutive_days: "", probation_months: "0", is_active: true,
};

const LEAVE_TYPES = ["vacation", "sick", "personal", "maternity", "paternity", "unpaid"];
const ACCRUAL_METHODS = ["annual", "monthly", "none"];

export default function LeavePolicies() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const leaveLabel = (lt: string) => ({
    vacation: t("vacation"), sick: t("sickLeave"), personal: t("personalLeave"),
    maternity: t("maternity"), paternity: t("paternity"), unpaid: t("unpaidLeave"),
  }[lt] || lt);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["leave-policies", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_policies").select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, leave_type: form.leave_type,
        annual_entitlement: Number(form.annual_entitlement),
        max_carryover: Number(form.max_carryover),
        accrual_method: form.accrual_method,
        requires_approval: form.requires_approval,
        min_days_advance: Number(form.min_days_advance),
        max_consecutive_days: form.max_consecutive_days ? Number(form.max_consecutive_days) : null,
        probation_months: Number(form.probation_months),
        is_active: form.is_active,
        tenant_id: tenantId!,
      };
      if (editId) {
        const { error } = await supabase.from("leave_policies").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leave_policies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-policies"] });
      toast.success(t("success"));
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leave_policies").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-policies"] });
      toast.success(t("success"));
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, leave_type: p.leave_type,
      annual_entitlement: String(p.annual_entitlement),
      max_carryover: String(p.max_carryover),
      accrual_method: p.accrual_method,
      requires_approval: p.requires_approval,
      min_days_advance: String(p.min_days_advance),
      max_consecutive_days: p.max_consecutive_days ? String(p.max_consecutive_days) : "",
      probation_months: String(p.probation_months),
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "type", label: t("leaveType"), render: (p) => <Badge variant="outline">{leaveLabel(p.leave_type)}</Badge> },
    { key: "entitlement", label: t("entitledDays") || "Pravo na dane", render: (p) => `${p.annual_entitlement} ${t("daysCount").toLowerCase()}` },
    { key: "carryover", label: t("carriedOverDays") || "Max prenos", hideOnMobile: true, render: (p) => p.max_carryover },
    { key: "advance", label: t("minAdvance") || "Min. najava", hideOnMobile: true, render: (p) => `${p.min_days_advance} ${t("daysCount").toLowerCase()}` },
    { key: "status", label: t("status"), render: (p) => <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? t("active") : t("inactive")}</Badge> },
    { key: "actions", label: t("actions"), render: (p) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(p); }}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("leavePolicies") || "Politike odsustva"}
        description={t("leavePoliciesDesc") || "Konfigurisanje pravila za sve tipove odsustva"}
        icon={Shield}
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <ResponsiveTable data={policies} columns={columns} keyExtractor={(p) => p.id} emptyMessage={t("noResults")} enableExport exportFilename="leave-policies" />
      )}

      {/* Bulk Entitlement Generator */}
      <BulkEntitlementGenerator />

      {/* Policy Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Godišnji odmor - standard" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("leaveType")}</Label>
                <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAVE_TYPES.map((lt) => <SelectItem key={lt} value={lt}>{leaveLabel(lt)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("accrualMethod") || "Način sticanja"}</Label>
                <Select value={form.accrual_method} onValueChange={(v) => setForm({ ...form, accrual_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCRUAL_METHODS.map((am) => <SelectItem key={am} value={am}>{am}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("entitledDays") || "Godišnji dani"}</Label>
                <Input type="number" min={0} value={form.annual_entitlement} onChange={(e) => setForm({ ...form, annual_entitlement: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("maxCarryover") || "Max prenos"}</Label>
                <Input type="number" min={0} value={form.max_carryover} onChange={(e) => setForm({ ...form, max_carryover: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("minAdvance") || "Min. dana unapred"}</Label>
                <Input type="number" min={0} value={form.min_days_advance} onChange={(e) => setForm({ ...form, min_days_advance: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("maxConsecutive") || "Max uzastopnih"}</Label>
                <Input type="number" min={0} value={form.max_consecutive_days} onChange={(e) => setForm({ ...form, max_consecutive_days: e.target.value })} placeholder={t("optional")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("probationMonths") || "Probni rok (meseci)"}</Label>
              <Input type="number" min={0} value={form.probation_months} onChange={(e) => setForm({ ...form, probation_months: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.requires_approval} onCheckedChange={(v) => setForm({ ...form, requires_approval: v })} />
                <Label>{t("requiresApproval") || "Zahteva odobrenje"}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>{t("active")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
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
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
