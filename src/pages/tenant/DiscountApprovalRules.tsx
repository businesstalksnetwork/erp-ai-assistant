import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Percent } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";

const AVAILABLE_ROLES = ["admin", "manager", "accountant", "user", "sales"];

interface RuleForm {
  role: string;
  max_discount_pct: string;
  requires_approval_above: string;
}

const emptyForm: RuleForm = { role: "user", max_discount_pct: "10", requires_approval_above: "" };

export default function DiscountApprovalRules() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["discount_approval_rules", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_approval_rules" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!,
        role: form.role,
        max_discount_pct: Number(form.max_discount_pct),
        requires_approval_above: form.requires_approval_above ? Number(form.requires_approval_above) : null,
      };
      if (editId) {
        const { error } = await supabase.from("discount_approval_rules" as any).update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("discount_approval_rules" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discount_approval_rules", tenantId] });
      toast.success(t("success"));
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_approval_rules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discount_approval_rules", tenantId] });
      toast.success(t("success"));
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      role: r.role,
      max_discount_pct: String(r.max_discount_pct),
      requires_approval_above: r.requires_approval_above != null ? String(r.requires_approval_above) : "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("discountApprovalRules" as any)}
        icon={Percent}
        description={t("discountApprovalRules" as any)}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addRule" as any)}</Button>}
      />

      <Card>
        <CardHeader><CardTitle>{t("discountApprovalRules" as any)}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : rules.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("roles")}</TableHead>
                  <TableHead>{t("maxDiscountPct" as any)}</TableHead>
                  <TableHead>{t("requiresApprovalAbove" as any)}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.role}</TableCell>
                    <TableCell>{r.max_discount_pct}%</TableCell>
                    <TableCell>{r.requires_approval_above != null ? `${r.requires_approval_above}%` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("addRule" as any)}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("roles")}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("maxDiscountPct" as any)}</Label>
                <Input type="number" min={0} max={100} value={form.max_discount_pct} onChange={(e) => setForm({ ...form, max_discount_pct: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("requiresApprovalAbove" as any)}</Label>
                <Input type="number" min={0} max={100} value={form.requires_approval_above} onChange={(e) => setForm({ ...form, requires_approval_above: e.target.value })} placeholder={t("optional")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.role}>{t("save")}</Button>
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
