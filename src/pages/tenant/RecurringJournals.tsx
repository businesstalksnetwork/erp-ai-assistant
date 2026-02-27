import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Play, Pause, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

export default function RecurringJournals() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    template_name: "", description: "", frequency: "monthly",
    next_run_date: format(new Date(), "yyyy-MM-dd"), end_date: "", auto_post: false,
  });

  const FREQ_LABELS: Record<string, string> = {
    weekly: t("weekly"), monthly: t("monthly"), quarterly: t("quarterly"),
    semi_annual: t("semiAnnual"), annual: t("annual"),
  };

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["recurring-journals", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("recurring_journals").select("*").eq("tenant_id", tenantId).order("next_run_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recurring_journals").insert({
        tenant_id: tenantId!, template_name: form.template_name,
        description: form.description || null, frequency: form.frequency,
        next_run_date: form.next_run_date, end_date: form.end_date || null, auto_post: form.auto_post,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("templateCreated") });
      qc.invalidateQueries({ queryKey: ["recurring-journals"] });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("recurring_journals").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-journals"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_journals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("templateDeleted") });
      qc.invalidateQueries({ queryKey: ["recurring-journals"] });
    },
  });

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, sortable: true, sortValue: (tpl) => tpl.template_name, render: (tpl) => <span className="font-medium">{tpl.template_name}</span> },
    { key: "desc", label: t("description"), hideOnMobile: true, render: (tpl) => <span className="text-muted-foreground text-xs max-w-[200px] truncate block">{tpl.description || "—"}</span> },
    { key: "freq", label: t("frequency"), sortable: true, sortValue: (tpl) => tpl.frequency, render: (tpl) => FREQ_LABELS[tpl.frequency] || tpl.frequency },
    { key: "next", label: t("nextDate"), sortable: true, sortValue: (tpl) => tpl.next_run_date, render: (tpl) => tpl.next_run_date },
    { key: "auto", label: t("autoPost"), hideOnMobile: true, render: (tpl) => tpl.auto_post ? t("yes") : t("no") },
    { key: "status", label: t("status"), sortable: true, sortValue: (tpl) => tpl.is_active ? 1 : 0, render: (tpl) => <Badge variant={tpl.is_active ? "default" : "secondary"}>{tpl.is_active ? t("active") : t("paused")}</Badge> },
    {
      key: "actions", label: t("actions"), align: "right" as const, showInCard: false,
      render: (tpl) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleMut.mutate({ id: tpl.id, is_active: !tpl.is_active }); }}>
            {tpl.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteMut.mutate(tpl.id); }} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <Skeleton className="h-60" />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("recurringJournals")} description={t("recurringJournalsDesc")} />
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> {t("newTemplate")}</Button>
      </div>

      <ResponsiveTable
        data={templates}
        columns={columns}
        keyExtractor={(tpl) => tpl.id}
        emptyMessage={t("noTemplates")}
        enableExport
        exportFilename="recurring-journals"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newRecurringJournalTemplate")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("templateName")}</Label>
              <Input value={form.template_name} onChange={(e) => setForm({ ...form, template_name: e.target.value })} />
            </div>
            <div>
              <Label>{t("description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("frequency")}</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQ_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("nextDate")}</Label>
                <Input type="date" value={form.next_run_date} onChange={(e) => setForm({ ...form, next_run_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("endDateOptional")}</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.auto_post} onCheckedChange={(v) => setForm({ ...form, auto_post: v })} />
              <Label>{t("automaticPosting")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.template_name || createMut.isPending}>
              {createMut.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
