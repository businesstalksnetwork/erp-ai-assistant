import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Trash2, Pencil, Factory } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fmtNum } from "@/lib/utils";

export default function BomTemplates() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", product_id: "", notes: "" });
  const [lines, setLines] = useState<{ material_product_id: string; quantity: number; unit: string }[]>([]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["bom_templates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("bom_templates").select("*, products(name)").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("products").select("id, name, default_purchase_price").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = { tenant_id: tenantId, name: form.name, product_id: form.product_id || null, notes: form.notes || null };
      let bomId = editId;
      if (editId) {
        // Increment version instead of deleting old lines
        const { data: existing } = await supabase.from("bom_templates").select("version").eq("id", editId).single();
        const newVersion = (existing?.version || 1) + 1;
        await supabase.from("bom_templates").update({ ...payload, version: newVersion }).eq("id", editId);
        await supabase.from("bom_lines").delete().eq("bom_template_id", editId);
      } else {
        const { data } = await supabase.from("bom_templates").insert({ ...payload, version: 1 }).select("id").single();
        bomId = data!.id;
      }
      if (lines.length > 0) {
        await supabase.from("bom_lines").insert(lines.map((l, i) => ({ bom_template_id: bomId!, material_product_id: l.material_product_id, quantity: l.quantity, unit: l.unit, sort_order: i })));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom_templates"] });
      setOpen(false);
      toast({ title: t("success") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("bom_templates").delete().eq("id", id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bom_templates"] }),
  });

  const openCreate = () => { setEditId(null); setForm({ name: "", product_id: "", notes: "" }); setLines([]); setOpen(true); };

  const openEdit = async (tpl: any) => {
    setEditId(tpl.id);
    setForm({ name: tpl.name, product_id: tpl.product_id || "", notes: tpl.notes || "" });
    const { data } = await supabase.from("bom_lines").select("*").eq("bom_template_id", tpl.id).order("sort_order");
    setLines((data || []).map((l: any) => ({ material_product_id: l.material_product_id, quantity: Number(l.quantity), unit: l.unit })));
    setOpen(true);
  };

  const addLine = () => setLines([...lines, { material_product_id: "", quantity: 1, unit: "pcs" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, val: any) => setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("bomTemplates")}</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("product")}</TableHead>
            <TableHead>{t("bomVersion")}</TableHead>
            <TableHead>{t("notes")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5}>{t("loading")}</TableCell></TableRow>
          ) : templates.map((tpl: any) => (
            <TableRow key={tpl.id}>
              <TableCell className="font-medium">{tpl.name}</TableCell>
              <TableCell>{tpl.products?.name || "-"}</TableCell>
              <TableCell><Badge variant="outline">v{tpl.version || 1}</Badge></TableCell>
              <TableCell>{tpl.notes || "-"}</TableCell>
              <TableCell className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(tpl)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/production/orders?bom=${tpl.id}`)} title={t("createFromBom")}><Factory className="h-3 w-3" /></Button>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(tpl.id)}><Trash2 className="h-3 w-3" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("bomTemplates")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>{t("product")} ({t("optional")})</Label>
              <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>{t("materials")}</Label><Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" />{t("addLine")}</Button></div>
              {lines.map((line, i) => {
                const materialProduct = products.find((p: any) => p.id === line.material_product_id);
                const estCost = (materialProduct?.default_purchase_price || 0) * line.quantity;
                return (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select value={line.material_product_id} onValueChange={v => updateLine(i, "material_product_id", v)}>
                        <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                        <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="w-24"><Input type="number" value={line.quantity} onChange={e => updateLine(i, "quantity", Number(e.target.value))} /></div>
                    <div className="w-20"><Input value={line.unit} onChange={e => updateLine(i, "unit", e.target.value)} /></div>
                    <div className="w-24 text-right text-sm text-muted-foreground self-center" title={t("estimatedUnitCost")}>{estCost > 0 ? fmtNum(estCost) : "—"}</div>
                    <Button size="icon" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                );
              })}
              {lines.length > 0 && (
                <div className="flex justify-end text-sm font-medium border-t pt-2">
                  <span>{t("estimatedCost")}: {fmtNum(lines.reduce((sum, l) => {
                    const p = products.find((pr: any) => pr.id === l.material_product_id);
                    return sum + (p?.default_purchase_price || 0) * l.quantity;
                  }, 0))}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!form.name}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
