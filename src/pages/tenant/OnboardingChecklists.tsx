import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";

interface ChecklistItem {
  title: string;
  description: string;
}

interface ChecklistForm {
  id?: string;
  name: string;
  items: ChecklistItem[];
  is_active: boolean;
}

const emptyForm: ChecklistForm = { name: "", items: [{ title: "", description: "" }], is_active: true };

export default function OnboardingChecklists() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ChecklistForm>(emptyForm);

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ["onboarding-checklists-admin", tenantId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("onboarding_checklists" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("name") as any);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (f: ChecklistForm) => {
      const items = f.items.filter(i => i.title.trim());
      if (f.id) {
        const { error } = await (supabase
          .from("onboarding_checklists" as any)
          .update({ name: f.name, items, is_active: f.is_active, updated_at: new Date().toISOString() })
          .eq("id", f.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("onboarding_checklists" as any)
          .insert([{ tenant_id: tenantId, name: f.name, items, is_active: f.is_active }]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-checklists-admin"] });
      setDialogOpen(false);
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("onboarding_checklists" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-checklists-admin"] });
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setForm({ id: c.id, name: c.name, items: c.items || [], is_active: c.is_active });
    setDialogOpen(true);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { title: "", description: "" }] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: keyof ChecklistItem, val: string) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("onboardingChecklists" as any)} icon={ListChecks} description={t("onboardingChecklistsDesc" as any)} actions={
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      } />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : checklists.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t("noResults")}</CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("items" as any)}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checklists.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{(c.items || []).length}</TableCell>
                <TableCell>
                  <Badge variant={c.is_active ? "default" : "outline"}>
                    {c.is_active ? t("active") : t("inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? t("edit") : t("add")} {t("onboardingChecklists" as any)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("name")}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-3">
              <Label>{t("items" as any)}</Label>
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder={t("title")}
                      value={item.title}
                      onChange={e => updateItem(idx, "title", e.target.value)}
                    />
                    <Input
                      placeholder={t("description")}
                      value={item.description}
                      onChange={e => updateItem(idx, "description", e.target.value)}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="shrink-0 mt-1">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />{t("addItem" as any)}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
