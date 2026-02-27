import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Pencil, Trash2, ChevronRight, FolderTree } from "lucide-react";

interface Category {
  id: string;
  tenant_id: string;
  name: string;
  name_sr: string | null;
  parent_id: string | null;
  code: string | null;
  sort_order: number;
  is_active: boolean;
}

interface CategoryForm {
  name: string;
  name_sr: string;
  parent_id: string;
  code: string;
  sort_order: number;
  is_active: boolean;
}

const emptyForm: CategoryForm = { name: "", name_sr: "", parent_id: "", code: "", sort_order: 0, is_active: true };

function buildTree(categories: Category[]): (Category & { children: Category[] })[] {
  const map = new Map<string | null, Category[]>();
  categories.forEach(c => {
    const pid = c.parent_id || null;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(c);
  });
  const build = (parentId: string | null): any[] => {
    const items = map.get(parentId) || [];
    return items
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({ ...c, children: build(c.id) }));
  };
  return build(null);
}

function CategoryNode({ cat, level, onEdit, onDelete, t }: {
  cat: Category & { children: any[] };
  level: number;
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
  t: (k: any) => string;
}) {
  const hasChildren = cat.children.length > 0;
  return (
    <Collapsible defaultOpen={level < 2}>
      <div
        className="flex items-center gap-2 py-2 px-3 hover:bg-accent/50 rounded-md group"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {hasChildren ? (
          <CollapsibleTrigger className="p-0.5">
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90 text-muted-foreground" />
          </CollapsibleTrigger>
        ) : (
          <span className="w-5" />
        )}
        <span className="flex-1 font-medium text-sm">{cat.name}</span>
        {cat.code && <span className="text-xs text-muted-foreground font-mono">{cat.code}</span>}
        {!cat.is_active && <span className="text-xs text-muted-foreground italic">{t("inactive")}</span>}
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(cat)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirm")}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(cat.id)}>{t("delete")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {hasChildren && (
        <CollapsibleContent>
          {cat.children.map((child: any) => (
            <CategoryNode key={child.id} cat={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} t={t} />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export default function ProductCategories() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order");
      if (error) throw error;
      return (data as any as Category[]) || [];
    },
    enabled: !!tenantId,
  });

  const tree = buildTree(categories);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        name_sr: form.name_sr || null,
        parent_id: form.parent_id || null,
        code: form.code || null,
        sort_order: form.sort_order,
        is_active: form.is_active,
        tenant_id: tenantId!,
      };
      if (editId) {
        const { error } = await supabase.from("product_categories" as any).update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_categories" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_categories"] });
      toast({ title: t("success") });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_categories"] });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      name_sr: c.name_sr || "",
      parent_id: c.parent_id || "",
      code: c.code || "",
      sort_order: c.sort_order,
      is_active: c.is_active,
    });
    setDialogOpen(true);
  };

  // Flatten for parent picker (exclude self and descendants)
  const parentOptions = categories.filter(c => c.id !== editId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("productCategories")}
        icon={FolderTree}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>}
      />

      <div className="border rounded-lg bg-card">
        {tree.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">{t("noResults")}</p>
        ) : (
          tree.map(cat => (
            <CategoryNode key={cat.id} cat={cat} level={0} onEdit={openEdit} onDelete={(id) => deleteMutation.mutate(id)} t={t} />
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? t("edit") : t("add")} {t("category")}</DialogTitle>
            <DialogDescription>{t("productCategories")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>{t("accountNameSr")}</Label><Input value={form.name_sr} onChange={e => setForm(f => ({ ...f, name_sr: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("code")}</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /></div>
              <div><Label>{t("sortOrder")}</Label><Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
            </div>
            <div>
              <Label>{t("parentCategory")}</Label>
              <Select value={form.parent_id} onValueChange={v => setForm(f => ({ ...f, parent_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder={t("noParent")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— {t("noParent")} —</SelectItem>
                  {parentOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
