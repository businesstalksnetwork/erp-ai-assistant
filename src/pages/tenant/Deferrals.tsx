import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Play } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { differenceInMonths, format } from "date-fns";

interface DeferralForm {
  type: string;
  description: string;
  total_amount: number;
  start_date: string;
  end_date: string;
  frequency: string;
  status: string;
}

const emptyForm: DeferralForm = {
  type: "revenue",
  description: "",
  total_amount: 0,
  start_date: new Date().toISOString().split("T")[0],
  end_date: new Date().toISOString().split("T")[0],
  frequency: "monthly",
  status: "active",
};

export default function Deferrals() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DeferralForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: deferrals = [], isLoading } = useQuery({
    queryKey: ["deferrals", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("deferrals").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const payload = { ...form, tenant_id: tenantId, recognized_amount: 0 };
      if (editId) {
        const { recognized_amount, ...updatePayload } = payload;
        const { error } = await supabase.from("deferrals").update(updatePayload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deferrals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deferrals", tenantId] });
      toast({ title: t("deferralSaved") });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deferrals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deferrals", tenantId] });
      toast({ title: t("deferralDeleted") });
      setDeleteId(null);
    },
  });

  const recognizeMutation = useMutation({
    mutationFn: async (d: any) => {
      if (!tenantId) return;
      const totalPeriods = Math.max(differenceInMonths(new Date(d.end_date), new Date(d.start_date)), 1);
      const perPeriod = Number(d.total_amount) / totalPeriods;
      const newRecognized = Math.min(Number(d.recognized_amount) + perPeriod, Number(d.total_amount));
      const newStatus = newRecognized >= Number(d.total_amount) ? "completed" : d.status;

      // Insert schedule entry
      const { error: schedError } = await supabase.from("deferral_schedules").insert({
        tenant_id: tenantId,
        deferral_id: d.id,
        period_date: format(new Date(), "yyyy-MM-dd"),
        amount: perPeriod,
        status: "recognized",
      });
      if (schedError) throw schedError;

      // Update recognized amount
      const { error } = await supabase.from("deferrals").update({ recognized_amount: newRecognized, status: newStatus }).eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deferrals", tenantId] });
      toast({ title: t("periodRecognized") });
    },
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (d: any) => {
    setEditId(d.id);
    setForm({ type: d.type, description: d.description || "", total_amount: Number(d.total_amount), start_date: d.start_date, end_date: d.end_date, frequency: d.frequency || "monthly", status: d.status });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("deferrals")}</h1>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />{t("addDeferral")}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("deferrals")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : deferrals.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("totalAmount")}</TableHead>
                  <TableHead>{t("recognizedAmount")}</TableHead>
                  <TableHead>{t("startDate")}</TableHead>
                  <TableHead>{t("endDate")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deferrals.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.type === "revenue" ? t("revenueType") : t("expenseType")}</TableCell>
                    <TableCell>{d.description || "—"}</TableCell>
                    <TableCell>{Number(d.total_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(d.recognized_amount).toLocaleString()}</TableCell>
                    <TableCell>{d.start_date}</TableCell>
                    <TableCell>{d.end_date}</TableCell>
                    <TableCell><Badge variant={d.status === "active" ? "default" : "secondary"}>{t(d.status)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {d.status === "active" && Number(d.recognized_amount) < Number(d.total_amount) && (
                          <Button variant="ghost" size="icon" onClick={() => recognizeMutation.mutate(d)} title={t("recognizePeriod")}>
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("editDeferral") : t("addDeferral")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">{t("revenueType")}</SelectItem>
                  <SelectItem value="expense">{t("expenseType")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("description")}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>{t("totalAmount")}</Label>
              <Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("startDate")}</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("endDate")}</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="completed">{t("completed")}</SelectItem>
                </SelectContent>
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
