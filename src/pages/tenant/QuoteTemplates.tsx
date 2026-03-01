import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy, FileText } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  unit: string;
}

const emptyItem: LineItem = { description: "", quantity: 1, unit_price: 0, unit: "kom" };

interface TemplateForm {
  name: string;
  description: string;
  items: LineItem[];
  terms_text: string;
  validity_days: number;
  currency: string;
  is_active: boolean;
}

const emptyForm: TemplateForm = {
  name: "", description: "", items: [{ ...emptyItem }], terms_text: "", validity_days: 30, currency: "RSD", is_active: true,
};

export default function QuoteTemplates() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>({ ...emptyForm });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["quote_templates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("quote_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = {
        tenant_id: tenantId,
        name: form.name,
        description: form.description || null,
        items: form.items as any,
        terms_text: form.terms_text || null,
        validity_days: form.validity_days,
        currency: form.currency,
        is_active: form.is_active,
      };
      if (editId) {
        const { error } = await supabase.from("quote_templates").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quote_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote_templates"] });
      toast({ title: t("success") });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quote_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote_templates"] });
      toast({ title: t("deleted" as any) || "Obrisano" });
    },
  });

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setDialogOpen(true); };

  const openEdit = (tmpl: any) => {
    setEditId(tmpl.id);
    setForm({
      name: tmpl.name,
      description: tmpl.description || "",
      items: (tmpl.items as LineItem[]) || [{ ...emptyItem }],
      terms_text: tmpl.terms_text || "",
      validity_days: tmpl.validity_days || 30,
      currency: tmpl.currency || "RSD",
      is_active: tmpl.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const duplicateTemplate = (tmpl: any) => {
    setEditId(null);
    setForm({
      name: `${tmpl.name} (kopija)`,
      description: tmpl.description || "",
      items: (tmpl.items as LineItem[]) || [{ ...emptyItem }],
      terms_text: tmpl.terms_text || "",
      validity_days: tmpl.validity_days || 30,
      currency: tmpl.currency || "RSD",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditId(null); };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setForm(f => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it),
    }));
  };

  const itemsTotal = form.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("quoteTemplates" as any) || "Šabloni ponuda"}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{t("addNew" as any) || "Dodaj"}</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("description" as any) || "Opis"}</TableHead>
                <TableHead className="text-right">{t("items" as any) || "Stavke"}</TableHead>
                <TableHead className="text-right">{t("validityDays" as any) || "Važi dana"}</TableHead>
                <TableHead>{t("currency" as any) || "Valuta"}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("loading")}</TableCell></TableRow>
              ) : templates.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("noResults" as any) || "Nema šablona"}</TableCell></TableRow>
              ) : templates.map((tmpl: any) => (
                <TableRow key={tmpl.id}>
                  <TableCell className="font-medium">{tmpl.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{tmpl.description || "—"}</TableCell>
                  <TableCell className="text-right">{(tmpl.items as any[])?.length || 0}</TableCell>
                  <TableCell className="text-right">{tmpl.validity_days}</TableCell>
                  <TableCell>{tmpl.currency}</TableCell>
                  <TableCell>
                    <Badge variant={tmpl.is_active ? "default" : "outline"}>
                      {tmpl.is_active ? t("active" as any) || "Aktivan" : t("inactive" as any) || "Neaktivan"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" onClick={() => openEdit(tmpl)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => duplicateTemplate(tmpl)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(tmpl.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? t("edit" as any) || "Izmeni" : t("addNew" as any) || "Novi"} {t("quoteTemplate" as any) || "šablon ponude"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("name")}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("validityDays" as any) || "Važi dana"}</Label>
                  <Input type="number" value={form.validity_days} onChange={e => setForm(f => ({ ...f, validity_days: parseInt(e.target.value) || 30 }))} />
                </div>
                <div>
                  <Label>{t("currency" as any) || "Valuta"}</Label>
                  <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <Label>{t("description" as any) || "Opis"}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t("lineItems" as any) || "Stavke"}</Label>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />{t("addItem" as any) || "Dodaj stavku"}</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {idx === 0 && <Label className="text-xs">{t("description" as any) || "Opis"}</Label>}
                      <Input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Opis stavke" />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs">{t("quantity" as any) || "Kol."}</Label>}
                      <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs">{t("unit" as any) || "JM"}</Label>}
                      <Input value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs">{t("price" as any) || "Cena"}</Label>}
                      <Input type="number" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1">
                      <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right text-sm font-medium mt-2">
                {t("total")}: {itemsTotal.toFixed(2)} {form.currency}
              </div>
            </div>

            <div>
              <Label>{t("terms" as any) || "Uslovi"}</Label>
              <Textarea value={form.terms_text} onChange={e => setForm(f => ({ ...f, terms_text: e.target.value }))} rows={3} placeholder="Uslovi plaćanja, rokovi isporuke..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
