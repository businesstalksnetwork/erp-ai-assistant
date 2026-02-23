import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TrendingUp, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import type { OpportunityStage } from "@/hooks/useOpportunityStages";

const defaultColors = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#6366F1",
];

interface FormData {
  code: string;
  name: string;
  name_sr: string;
  color: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
}

const emptyForm: FormData = { code: "", name: "", name_sr: "", color: defaultColors[0], sort_order: 0, is_won: false, is_lost: false };

export default function OpportunityStagesSettings() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<OpportunityStage | null>(null);
  const [deleting, setDeleting] = useState<OpportunityStage | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["opportunity-stages", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_stages" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as OpportunityStage[];
    },
    enabled: !!tenantId,
  });

  const { data: stagesInUse } = useQuery({
    queryKey: ["stages-in-use", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("stage")
        .eq("tenant_id", tenantId!);
      return new Set((data || []).map((o: any) => o.stage));
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (d: FormData) => {
      const { error } = await supabase.from("opportunity_stages" as any).insert({
        code: d.code.toLowerCase().replace(/\s+/g, "_"),
        name: d.name,
        name_sr: d.name_sr || null,
        color: d.color,
        sort_order: d.sort_order,
        is_won: d.is_won,
        is_lost: d.is_lost,
        is_system: false,
        tenant_id: tenantId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity-stages"] });
      toast.success(t("success"));
      setIsAddOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message?.includes("unique") ? "Kod već postoji" : e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, d }: { id: string; d: FormData }) => {
      const { error } = await supabase.from("opportunity_stages" as any).update({
        name: d.name,
        name_sr: d.name_sr || null,
        color: d.color,
        sort_order: d.sort_order,
        is_won: d.is_won,
        is_lost: d.is_lost,
        ...(editing && !editing.is_system ? { code: d.code.toLowerCase().replace(/\s+/g, "_") } : {}),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity-stages"] });
      toast.success(t("success"));
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunity_stages" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity-stages"] });
      toast.success(t("success"));
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (s: OpportunityStage) => {
    setForm({ code: s.code, name: s.name, name_sr: s.name_sr || "", color: s.color || defaultColors[0], sort_order: s.sort_order, is_won: s.is_won, is_lost: s.is_lost });
    setEditing(s);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) { toast.error("Name and code are required"); return; }
    if (editing) updateMutation.mutate({ id: editing.id, d: form });
    else createMutation.mutate(form);
  };

  const canDelete = (s: OpportunityStage) => !s.is_system && !stagesInUse?.has(s.code);
  const displayName = (s: OpportunityStage) => s.name_sr || s.name;

  const StageForm = () => (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("name")} (EN) *</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Qualification" />
        </div>
        <div className="space-y-2">
          <Label>{t("name")} (SR)</Label>
          <Input value={form.name_sr} onChange={e => setForm({ ...form, name_sr: e.target.value })} placeholder="npr. Kvalifikacija" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("stageCode")} *</Label>
          <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
            disabled={!!editing?.is_system} placeholder="e.g. qualification" />
          {editing?.is_system && <p className="text-xs text-muted-foreground">Kod sistemskih faza se ne može menjati</p>}
        </div>
        <div className="space-y-2">
          <Label>Sort Order</Label>
          <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("categoryColor")}</Label>
        <div className="flex flex-wrap gap-2">
          {defaultColors.map(color => (
            <button key={color} type="button"
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
              style={{ backgroundColor: color, borderColor: form.color === color ? "white" : "transparent", boxShadow: form.color === color ? `0 0 0 2px ${color}` : "none" }}
              onClick={() => setForm({ ...form, color })}>
              {form.color === color && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Checkbox id="is_won" checked={form.is_won} onCheckedChange={c => setForm({ ...form, is_won: !!c, is_lost: c ? false : form.is_lost })} />
          <Label htmlFor="is_won">{t("isWon")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="is_lost" checked={form.is_lost} onCheckedChange={c => setForm({ ...form, is_lost: !!c, is_won: c ? false : form.is_won })} />
          <Label htmlFor="is_lost">{t("isLost")}</Label>
        </div>
      </div>
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("opportunityStages")} icon={TrendingUp} description={t("opportunityStages")} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />{t("opportunityStages")}</CardTitle>
              <CardDescription>Upravljajte fazama prodajnog levka</CardDescription>
            </div>
            <Dialog open={isAddOpen} onOpenChange={o => { setIsAddOpen(o); if (!o) setForm(emptyForm); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader><DialogTitle>{t("add")}</DialogTitle><DialogDescription>Dodajte novu fazu prilike</DialogDescription></DialogHeader>
                  <StageForm />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>{t("cancel")}</Button>
                    <Button type="submit" disabled={createMutation.isPending}>{t("save")}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("stageCode")}</TableHead>
                <TableHead>{t("categoryColor")}</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.sort_order}</TableCell>
                  <TableCell className="font-medium">{displayName(s)}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.code}</code></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color || "#888" }} />
                      <span className="text-xs text-muted-foreground">{s.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {s.is_won && <Badge variant="default" className="text-xs">Won</Badge>}
                      {s.is_lost && <Badge variant="destructive" className="text-xs">Lost</Badge>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={s.is_system ? "secondary" : "outline"}>{s.is_system ? "System" : "Custom"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={!canDelete(s)} onClick={() => setDeleting(s)}
                        title={!canDelete(s) ? (s.is_system ? "System stage" : t("cannotDeleteStageInUse")) : t("delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {stages.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={o => { if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>{t("edit")}</DialogTitle></DialogHeader>
            <StageForm />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>{t("cancel")}</Button>
              <Button type="submit" disabled={updateMutation.isPending}>{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
