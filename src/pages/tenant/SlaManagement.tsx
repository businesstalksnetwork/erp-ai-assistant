/**
 * ITSM-01: SLA Management Page
 * ISO 20000 — Service Level Agreement definitions and measurements.
 */
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Target, TrendingUp, AlertTriangle } from "lucide-react";

export default function SlaManagement() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [selectedSla, setSelectedSla] = useState<any>(null);
  const [form, setForm] = useState({ name: "", service_name: "", metric_type: "availability", target_value: "99.9", unit: "percent", measurement_period: "monthly", penalty_description: "" });
  const [measureForm, setMeasureForm] = useState({ actual_value: "", period_start: "", period_end: "", notes: "" });

  const { data: slas = [] } = useQuery({
    queryKey: ["sla_definitions", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("sla_definitions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: measurements = [] } = useQuery({
    queryKey: ["sla_measurements", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("sla_measurements").select("*, sla_definitions(name, target_value, unit)").eq("tenant_id", tenantId).order("period_end", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      await supabase.from("sla_definitions").insert({
        tenant_id: tenantId,
        name: form.name,
        service_name: form.service_name,
        metric_type: form.metric_type,
        target_value: parseFloat(form.target_value),
        unit: form.unit,
        measurement_period: form.measurement_period,
        penalty_description: form.penalty_description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla_definitions"] });
      setCreateOpen(false);
      setForm({ name: "", service_name: "", metric_type: "availability", target_value: "99.9", unit: "percent", measurement_period: "monthly", penalty_description: "" });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const measureMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !selectedSla) return;
      const actual = parseFloat(measureForm.actual_value);
      await supabase.from("sla_measurements").insert({
        tenant_id: tenantId,
        sla_id: selectedSla.id,
        actual_value: actual,
        period_start: measureForm.period_start,
        period_end: measureForm.period_end,
        target_met: actual >= selectedSla.target_value,
        notes: measureForm.notes || null,
        measured_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla_measurements"] });
      setMeasureOpen(false);
      setSelectedSla(null);
      setMeasureForm({ actual_value: "", period_start: "", period_end: "", notes: "" });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const metCount = measurements.filter((m: any) => m.target_met).length;
  const totalMeasurements = measurements.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{"SLA Management"}</h1>
          <p className="text-sm text-muted-foreground">ISO 20000 — Service Level Agreement tracking</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />{"New SLA"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Active SLAs</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{slas.filter((s: any) => s.is_active).length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Targets Met</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{metCount}/{totalMeasurements}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Breaches</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalMeasurements - metCount}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="definitions">
        <TabsList>
          <TabsTrigger value="definitions">{"Definitions"} ({slas.length})</TabsTrigger>
          <TabsTrigger value="measurements">{"Measurements"} ({measurements.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{"Service"}</TableHead>
                <TableHead>{"Metric"}</TableHead>
                <TableHead>{"Target"}</TableHead>
                <TableHead>{"Period"}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slas.map((sla: any) => (
                <TableRow key={sla.id}>
                  <TableCell className="font-medium">{sla.name}</TableCell>
                  <TableCell>{sla.service_name}</TableCell>
                  <TableCell><Badge variant="outline">{sla.metric_type}</Badge></TableCell>
                  <TableCell>{sla.target_value}{sla.unit === "percent" ? "%" : ` ${sla.unit}`}</TableCell>
                  <TableCell>{sla.measurement_period}</TableCell>
                  <TableCell><Badge variant={sla.is_active ? "default" : "secondary"}>{sla.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedSla(sla); setMeasureOpen(true); }}>
                      {"Record"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {slas.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="measurements">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{"SLA"}</TableHead>
                <TableHead>{"Period"}</TableHead>
                <TableHead>{"Actual"}</TableHead>
                <TableHead>{"Target Met"}</TableHead>
                <TableHead>{t("notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {measurements.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.sla_definitions?.name || "—"}</TableCell>
                  <TableCell>{m.period_start} → {m.period_end}</TableCell>
                  <TableCell>{m.actual_value}{m.sla_definitions?.unit === "percent" ? "%" : ""}</TableCell>
                  <TableCell><Badge variant={m.target_met ? "default" : "destructive"}>{m.target_met ? "✓ Met" : "✗ Breached"}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.notes || "—"}</TableCell>
                </TableRow>
              ))}
              {measurements.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Create SLA Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{"New SLA Definition"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{"Service Name"}</Label><Input value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{"Metric Type"}</Label>
                <Select value={form.metric_type} onValueChange={v => setForm(f => ({ ...f, metric_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="availability">Availability</SelectItem>
                    <SelectItem value="response_time">Response Time</SelectItem>
                    <SelectItem value="resolution_time">Resolution Time</SelectItem>
                    <SelectItem value="throughput">Throughput</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{"Target Value"}</Label><Input type="number" value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{"Unit"}</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="ms">Milliseconds</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{"Period"}</Label>
                <Select value={form.measurement_period} onValueChange={v => setForm(f => ({ ...f, measurement_period: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{"Penalty Description"}</Label><Textarea value={form.penalty_description} onChange={e => setForm(f => ({ ...f, penalty_description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.service_name}>{"Create SLA"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Measurement Dialog */}
      <Dialog open={measureOpen} onOpenChange={setMeasureOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{"Record Measurement"}{selectedSla ? `: ${selectedSla.name}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {selectedSla && <p className="text-sm text-muted-foreground">Target: {selectedSla.target_value}{selectedSla.unit === "percent" ? "%" : ` ${selectedSla.unit}`}</p>}
            <div><Label>{"Actual Value"}</Label><Input type="number" value={measureForm.actual_value} onChange={e => setMeasureForm(f => ({ ...f, actual_value: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{"Period Start"}</Label><Input type="date" value={measureForm.period_start} onChange={e => setMeasureForm(f => ({ ...f, period_start: e.target.value }))} /></div>
              <div><Label>{"Period End"}</Label><Input type="date" value={measureForm.period_end} onChange={e => setMeasureForm(f => ({ ...f, period_end: e.target.value }))} /></div>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={measureForm.notes} onChange={e => setMeasureForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => measureMutation.mutate()} disabled={!measureForm.actual_value || !measureForm.period_start || !measureForm.period_end}>{"Record"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
