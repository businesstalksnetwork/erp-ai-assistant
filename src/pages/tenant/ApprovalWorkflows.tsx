import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

interface WorkflowForm {
  name: string;
  entity_type: string;
  min_approvers: number;
  threshold_amount: string;
  is_active: boolean;
  required_roles: string[];
}

const emptyForm: WorkflowForm = {
  name: "",
  entity_type: "invoice",
  min_approvers: 1,
  threshold_amount: "",
  is_active: true,
  required_roles: [],
};

const ENTITY_TYPES = ["invoice", "journal_entry", "purchase_order", "sales_order", "expense"];
const AVAILABLE_ROLES = ["admin", "manager", "accountant", "user"];

export default function ApprovalWorkflows() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkflowForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["approval_workflows", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("approval_workflows").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const payload = {
        name: form.name, entity_type: form.entity_type, min_approvers: form.min_approvers,
        threshold_amount: form.threshold_amount ? Number(form.threshold_amount) : null,
        is_active: form.is_active, required_roles: form.required_roles, tenant_id: tenantId,
      };
      if (editId) {
        const { error } = await supabase.from("approval_workflows").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("approval_workflows").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval_workflows", tenantId] });
      toast({ title: t("workflowSaved") });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("approval_workflows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval_workflows", tenantId] });
      toast({ title: t("workflowDeleted") });
      setDeleteId(null);
    },
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (w: any) => {
    setEditId(w.id);
    setForm({ name: w.name, entity_type: w.entity_type, min_approvers: w.min_approvers, threshold_amount: w.threshold_amount ? String(w.threshold_amount) : "", is_active: w.is_active, required_roles: w.required_roles || [] });
    setDialogOpen(true);
  };

  const addRole = (role: string) => {
    if (role && !form.required_roles.includes(role)) {
      setForm({ ...form, required_roles: [...form.required_roles, role] });
    }
    setNewRole("");
  };
  const removeRole = (role: string) => {
    setForm({ ...form, required_roles: form.required_roles.filter((r) => r !== role) });
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, sortable: true, sortValue: (w) => w.name, render: (w) => <span className="font-medium">{w.name}</span> },
    { key: "entityType", label: t("entityType"), sortable: true, sortValue: (w) => w.entity_type, render: (w) => w.entity_type },
    { key: "minApprovers", label: t("minApprovers"), hideOnMobile: true, render: (w) => w.min_approvers },
    { key: "threshold", label: t("thresholdAmount"), hideOnMobile: true, sortable: true, sortValue: (w) => Number(w.threshold_amount || 0), render: (w) => w.threshold_amount ? Number(w.threshold_amount).toLocaleString() : "—" },
    { key: "roles", label: t("requiredRoles"), hideOnMobile: true, render: (w) => (
      <div className="flex gap-1 flex-wrap">{(w.required_roles || []).map((r: string) => <Badge key={r} variant="outline">{r}</Badge>)}</div>
    )},
    { key: "status", label: t("status"), sortable: true, sortValue: (w) => w.is_active ? 1 : 0, render: (w) => <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? t("active") : t("inactive")}</Badge> },
    { key: "actions", label: t("actions"), render: (w) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(w); }}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(w.id); }}><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("approvalWorkflows")}</h1>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />{t("addWorkflow")}</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : (
        <ResponsiveTable
          data={workflows}
          columns={columns}
          keyExtractor={(w) => w.id}
          emptyMessage={t("noResults")}
          enableExport
          exportFilename="approval-workflows"
          enableColumnToggle
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("editWorkflow") : t("addWorkflow")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>{t("entityType")}</Label>
              <Select value={form.entity_type} onValueChange={(v) => setForm({ ...form, entity_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENTITY_TYPES.map((et) => <SelectItem key={et} value={et}>{et.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("minApprovers")}</Label>
                <Input type="number" min={1} value={form.min_approvers} onChange={(e) => setForm({ ...form, min_approvers: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("thresholdAmount")}</Label>
                <Input type="number" value={form.threshold_amount} onChange={(e) => setForm({ ...form, threshold_amount: e.target.value })} placeholder={t("optional")} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>{t("active")}</Label>
            </div>
            <div className="grid gap-2">
              <Label>{t("requiredRoles")}</Label>
              <div className="flex gap-1 flex-wrap mb-2">
                {form.required_roles.map((r) => (
                  <Badge key={r} variant="secondary" className="gap-1">{r}<button onClick={() => removeRole(r)}><X className="h-3 w-3" /></button></Badge>
                ))}
              </div>
              <Select value={newRole} onValueChange={(v) => addRole(v)}>
                <SelectTrigger><SelectValue placeholder={t("add")} /></SelectTrigger>
                <SelectContent>{AVAILABLE_ROLES.filter((r) => !form.required_roles.includes(r)).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{t("save")}</Button>
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
