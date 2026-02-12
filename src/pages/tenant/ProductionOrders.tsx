import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";

const STATUSES = ["draft", "planned", "in_progress", "completed", "cancelled"] as const;

export default function ProductionOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ product_id: "", bom_template_id: "", quantity: 1, status: "draft" as string, planned_start: "", planned_end: "", notes: "" });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["production_orders", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("production_orders").select("*, products(name), bom_templates(name)").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: boms = [] } = useQuery({
    queryKey: ["bom_templates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("bom_templates").select("id, name").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = {
        tenant_id: tenantId,
        product_id: form.product_id || null,
        bom_template_id: form.bom_template_id || null,
        quantity: form.quantity,
        status: form.status,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        notes: form.notes || null,
        created_by: user?.id || null,
      };
      if (editId) {
        await supabase.from("production_orders").update(payload).eq("id", editId);
      } else {
        await supabase.from("production_orders").insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      setOpen(false);
      toast({ title: t("success") });
    },
  });

  const openCreate = () => { setEditId(null); setForm({ product_id: "", bom_template_id: "", quantity: 1, status: "draft", planned_start: "", planned_end: "", notes: "" }); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({ product_id: o.product_id || "", bom_template_id: o.bom_template_id || "", quantity: Number(o.quantity), status: o.status, planned_start: o.planned_start || "", planned_end: o.planned_end || "", notes: o.notes || "" });
    setOpen(true);
  };

  const statusColor = (s: string) => {
    switch (s) { case "completed": return "default"; case "in_progress": return "secondary"; case "cancelled": return "destructive"; default: return "outline"; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("productionOrders")}</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("product")}</TableHead>
            <TableHead>{t("bomTemplate")}</TableHead>
            <TableHead>{t("quantity")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("plannedStart")}</TableHead>
            <TableHead>{t("plannedEnd")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={7}>{t("loading")}</TableCell></TableRow>
          ) : orders.map((o: any) => (
            <TableRow key={o.id}>
              <TableCell>{o.products?.name || "-"}</TableCell>
              <TableCell>{o.bom_templates?.name || "-"}</TableCell>
              <TableCell>{o.quantity}</TableCell>
              <TableCell><Badge variant={statusColor(o.status)}>{t(o.status as any)}</Badge></TableCell>
              <TableCell>{o.planned_start || "-"}</TableCell>
              <TableCell>{o.planned_end || "-"}</TableCell>
              <TableCell><Button size="sm" variant="outline" onClick={() => openEdit(o)}><Pencil className="h-3 w-3" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("productionOrders")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("product")}</Label>
              <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("bomTemplate")}</Label>
              <Select value={form.bom_template_id} onValueChange={v => setForm({ ...form, bom_template_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{boms.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("quantity")}</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div>
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("plannedStart")}</Label><Input type="date" value={form.planned_start} onChange={e => setForm({ ...form, planned_start: e.target.value })} /></div>
              <div><Label>{t("plannedEnd")}</Label><Input type="date" value={form.planned_end} onChange={e => setForm({ ...form, planned_end: e.target.value })} /></div>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
