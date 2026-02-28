import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fmtNum } from "@/lib/utils";

const oeeColor = (v: number) => v >= 0.85 ? "text-green-600" : v >= 0.6 ? "text-yellow-600" : "text-destructive";
const oeeIcon = (v: number) => v >= 0.85 ? CheckCircle : v >= 0.6 ? AlertTriangle : XCircle;
const oeeBarColor = (v: number) => v >= 0.85 ? "hsl(var(--primary))" : v >= 0.6 ? "hsl(45, 93%, 47%)" : "hsl(var(--destructive))";

export default function OeeDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    work_center_id: "", log_date: new Date().toISOString().split("T")[0],
    planned_time_minutes: 480, actual_run_time_minutes: 0, downtime_minutes: 0,
    ideal_cycle_time_seconds: 0, total_units_produced: 0, good_units: 0, defect_units: 0, notes: "",
  });

  const { data: workCenters = [] } = useQuery({
    queryKey: ["work-centers", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("work_centers") as any).select("id, name, code").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: oeeLogs = [] } = useQuery({
    queryKey: ["oee-logs", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("oee_logs") as any).select("*, work_centers(name, code)").eq("tenant_id", tenantId!).order("log_date", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("oee_logs") as any).insert({ ...form, tenant_id: tenantId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["oee-logs"] }); setOpen(false); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Aggregate OEE per work center (latest entries)
  const wcOee = workCenters.map((wc: any) => {
    const logs = oeeLogs.filter((l: any) => l.work_center_id === wc.id);
    if (logs.length === 0) return { ...wc, availability: 0, performance: 0, quality: 0, oee: 0, count: 0 };
    const avg = (key: string) => logs.reduce((s: number, l: any) => s + (l[key] || 0), 0) / logs.length;
    const a = avg("availability"), p = avg("performance"), q = avg("quality");
    return { ...wc, availability: a, performance: p, quality: q, oee: a * p * q, count: logs.length };
  });

  const avgOee = wcOee.length > 0 ? wcOee.reduce((s: number, w: any) => s + w.oee, 0) / wcOee.length : 0;
  const AvgIcon = oeeIcon(avgOee);

  const stats = [
    { label: t("workCenters"), value: workCenters.length, icon: Activity, color: "text-primary" },
    { label: t("oeeScore"), value: `${(avgOee * 100).toFixed(1)}%`, icon: AvgIcon, color: oeeColor(avgOee) },
  ];

  const chartData = wcOee.map((w: any) => ({
    name: w.code || w.name,
    oee: +(w.oee * 100).toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("oeeDashboard")} description={t("oeeDashboard")} icon={Activity}
        actions={<Button onClick={() => { setForm({ work_center_id: "", log_date: new Date().toISOString().split("T")[0], planned_time_minutes: 480, actual_run_time_minutes: 0, downtime_minutes: 0, ideal_cycle_time_seconds: 0, total_units_produced: 0, good_units: 0, defect_units: 0, notes: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />{t("addOeeLog")}</Button>} />

      <StatsBar stats={stats} />

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("oeeScore")} — {t("workCenters")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="oee" name="OEE %">
                  {chartData.map((entry: any, i: number) => <Cell key={i} fill={oeeBarColor(entry.oee / 100)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("workCenters")} — OEE</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("workCenters")}</TableHead>
                <TableHead>{t("oeeAvailability")}</TableHead>
                <TableHead>{t("oeePerformance")}</TableHead>
                <TableHead>{t("oeeQuality")}</TableHead>
                <TableHead>{t("oeeScore")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wcOee.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : wcOee.map((w: any) => {
                const OeeIcon = oeeIcon(w.oee);
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>{(w.availability * 100).toFixed(1)}%</TableCell>
                    <TableCell>{(w.performance * 100).toFixed(1)}%</TableCell>
                    <TableCell>{(w.quality * 100).toFixed(1)}%</TableCell>
                    <TableCell className={`font-bold ${oeeColor(w.oee)}`}>{(w.oee * 100).toFixed(1)}%</TableCell>
                    <TableCell><OeeIcon className={`h-5 w-5 ${oeeColor(w.oee)}`} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("addOeeLog")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("workCenters")} *</Label>
                <Select value={form.work_center_id} onValueChange={(v) => setForm({ ...form, work_center_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{workCenters.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("date")}</Label><Input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{t("plannedTime")}</Label><Input type="number" value={form.planned_time_minutes} onChange={(e) => setForm({ ...form, planned_time_minutes: +e.target.value })} /></div>
              <div><Label>{t("actualRunTime")}</Label><Input type="number" value={form.actual_run_time_minutes} onChange={(e) => setForm({ ...form, actual_run_time_minutes: +e.target.value })} /></div>
              <div><Label>{t("downtime")}</Label><Input type="number" value={form.downtime_minutes} onChange={(e) => setForm({ ...form, downtime_minutes: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{t("totalUnitsProduced")}</Label><Input type="number" value={form.total_units_produced} onChange={(e) => setForm({ ...form, total_units_produced: +e.target.value })} /></div>
              <div><Label>{t("goodUnits")}</Label><Input type="number" value={form.good_units} onChange={(e) => setForm({ ...form, good_units: +e.target.value })} /></div>
              <div><Label>{t("defectUnits")}</Label><Input type="number" value={form.defect_units} onChange={(e) => setForm({ ...form, defect_units: +e.target.value })} /></div>
            </div>
            <div><Label>{t("idealCycleTime")}</Label><Input type="number" value={form.ideal_cycle_time_seconds} onChange={(e) => setForm({ ...form, ideal_cycle_time_seconds: +e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.work_center_id || saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
