import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, Plus, CheckCircle, Clock, AlertTriangle, Calendar } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export default function ProductionMaintenance() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    equipment_name: "", maintenance_type: "preventive", scheduled_date: "",
    cost: 0, downtime_hours: 0, notes: "",
  });

  const { data: records = [] } = useQuery({
    queryKey: ["production-maintenance", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_maintenance")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("production_maintenance").insert({
        tenant_id: tenantId!,
        equipment_name: form.equipment_name,
        maintenance_type: form.maintenance_type,
        scheduled_date: form.scheduled_date || null,
        cost: form.cost,
        downtime_hours: form.downtime_hours,
        notes: form.notes || null,
        assigned_to: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-maintenance"] });
      toast({ title: t("success") });
      setCreateOpen(false);
      setForm({ equipment_name: "", maintenance_type: "preventive", scheduled_date: "", cost: 0, downtime_hours: 0, notes: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, completed_date }: { id: string; status: string; completed_date?: string }) => {
      const { error } = await supabase.from("production_maintenance").update({ status, completed_date }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-maintenance"] });
      toast({ title: t("success") });
    },
  });

  const scheduled = records.filter((r: any) => r.status === "scheduled").length;
  const inProgress = records.filter((r: any) => r.status === "in_progress").length;
  const completed = records.filter((r: any) => r.status === "completed").length;
  const overdue = records.filter((r: any) => r.status === "scheduled" && r.scheduled_date && new Date(r.scheduled_date) < new Date()).length;
  const totalCost = records.reduce((s: number, r: any) => s + (r.cost || 0), 0);
  const totalDowntime = records.reduce((s: number, r: any) => s + (r.downtime_hours || 0), 0);

  const stats = [
    { label: t("scheduledLabel"), value: scheduled, icon: Calendar, color: "text-primary" },
    { label: t("in_progress"), value: inProgress, icon: Clock, color: "text-amber-500" },
    { label: t("overdueCount"), value: overdue, icon: AlertTriangle, color: "text-destructive" },
    { label: t("totalDowntime"), value: `${totalDowntime}h`, icon: Wrench, color: "text-muted-foreground" },
  ];

  const statusBadge = (s: string) => {
    const v: Record<string, "default" | "secondary" | "destructive" | "outline"> = { scheduled: "outline", in_progress: "secondary", completed: "default", overdue: "destructive" };
    return <Badge variant={v[s] || "outline"}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("maintenanceTitle")}
        description={t("maintenanceDesc")}
        icon={Wrench}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>}
      />

      <StatsBar stats={stats} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("equipmentLabel")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("scheduledLabel")}</TableHead>
                <TableHead>{t("completedLabel")}</TableHead>
                <TableHead>{t("costLabel")}</TableHead>
                <TableHead>{t("downtimeHours")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : records.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.equipment_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.maintenance_type}</Badge></TableCell>
                  <TableCell className="text-xs">{r.scheduled_date || "—"}</TableCell>
                  <TableCell className="text-xs">{r.completed_date || "—"}</TableCell>
                  <TableCell>{fmtNum(r.cost)}</TableCell>
                  <TableCell>{r.downtime_hours || 0}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.status === "scheduled" && (
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: r.id, status: "in_progress" })}>
                          {t("startAction")}
                        </Button>
                      )}
                      {r.status === "in_progress" && (
                        <Button size="sm" onClick={() => updateMutation.mutate({ id: r.id, status: "completed", completed_date: new Date().toISOString().split("T")[0] })}>
                          <CheckCircle className="h-3 w-3 mr-1" />{t("completeAction")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("newMaintenance")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>{t("equipmentLabel")}</Label><Input value={form.equipment_name} onChange={e => setForm({ ...form, equipment_name: e.target.value })} /></div>
            <div>
              <Label>{t("type")}</Label>
              <Select value={form.maintenance_type} onValueChange={v => setForm({ ...form, maintenance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive">{t("preventiveType")}</SelectItem>
                  <SelectItem value="corrective">{t("correctiveType")}</SelectItem>
                  <SelectItem value="predictive">{t("predictiveType")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("scheduledFor")}</Label><Input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("costLabel")}</Label><Input type="number" min={0} value={form.cost} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} /></div>
              <div><Label>{t("downtimeHours")}</Label><Input type="number" min={0} value={form.downtime_hours} onChange={e => setForm({ ...form, downtime_hours: Number(e.target.value) })} /></div>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.equipment_name || createMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
