import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, Clock, Shield, CheckCircle2 } from "lucide-react";

const severityColors: Record<string, string> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
};

export default function DataBreachIncidents() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "medium",
    affected_data_types: "",
    affected_record_count: 0,
  });

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["data_breach_incidents", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("data_breach_incidents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase.from("data_breach_incidents").insert({
        tenant_id: tenantId,
        title: form.title,
        description: form.description || null,
        severity: form.severity,
        affected_data_types: form.affected_data_types ? form.affected_data_types.split(",").map(s => s.trim()) : [],
        affected_record_count: form.affected_record_count,
        reported_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data_breach_incidents"] });
      toast({ title: t("success") });
      setDialogOpen(false);
      setForm({ title: "", description: "", severity: "medium", affected_data_types: "", affected_record_count: 0 });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "reported") updates.reported_at = new Date().toISOString();
      if (status === "resolved") updates.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("data_breach_incidents").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data_breach_incidents"] });
      toast({ title: t("success") });
    },
  });

  const now = new Date();
  const urgentCount = incidents.filter((i: any) =>
    i.status !== "resolved" && i.status !== "reported" && i.notification_deadline && new Date(i.notification_deadline) < now
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dataBreachIncidents" as any) || "Incidenti zaštite podataka"}
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("report" as any) || "Prijavi incident"}</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div><p className="text-2xl font-bold">{urgentCount}</p><p className="text-xs text-muted-foreground">Istekao rok 72h</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-warning" />
          <div><p className="text-2xl font-bold">{incidents.filter((i: any) => i.status === "investigating").length}</p><p className="text-xs text-muted-foreground">U istrazi</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div><p className="text-2xl font-bold">{incidents.filter((i: any) => i.status === "contained").length}</p><p className="text-xs text-muted-foreground">Obuzdan</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <div><p className="text-2xl font-bold">{incidents.filter((i: any) => i.status === "resolved").length}</p><p className="text-xs text-muted-foreground">Rešeno</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naslov</TableHead>
                <TableHead>Ozbiljnost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detektovano</TableHead>
                <TableHead>Rok (72h)</TableHead>
                <TableHead>Pogođeno zapisa</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("loading")}</TableCell></TableRow>
              ) : incidents.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nema prijavljenih incidenata</TableCell></TableRow>
              ) : incidents.map((inc: any) => {
                const deadlinePassed = inc.notification_deadline && new Date(inc.notification_deadline) < now && inc.status !== "resolved" && inc.status !== "reported";
                return (
                  <TableRow key={inc.id}>
                    <TableCell className="font-medium">{inc.title}</TableCell>
                    <TableCell><Badge variant={severityColors[inc.severity] as any}>{inc.severity}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{inc.status}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(inc.detected_at).toLocaleString()}</TableCell>
                    <TableCell className={deadlinePassed ? "text-destructive font-medium text-xs" : "text-xs"}>
                      {inc.notification_deadline ? new Date(inc.notification_deadline).toLocaleString() : "—"}
                      {deadlinePassed && " ⚠️"}
                    </TableCell>
                    <TableCell className="text-right">{inc.affected_record_count}</TableCell>
                    <TableCell>
                      {inc.status !== "resolved" && (
                        <Select onValueChange={(v) => updateStatus.mutate({ id: inc.id, status: v })}>
                          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Promeni" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="investigating">Istraga</SelectItem>
                            <SelectItem value="contained">Obuzdan</SelectItem>
                            <SelectItem value="reported">Prijavljen</SelectItem>
                            <SelectItem value="resolved">Rešen</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Prijavi incident zaštite podataka</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Naslov</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Opis</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ozbiljnost</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Broj pogođenih zapisa</Label><Input type="number" min={0} value={form.affected_record_count} onChange={e => setForm(f => ({ ...f, affected_record_count: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div><Label>Pogođeni tipovi podataka (razdvojeno zarezom)</Label><Input value={form.affected_data_types} onChange={e => setForm(f => ({ ...f, affected_data_types: e.target.value }))} placeholder="JMBG, email, adresa" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title.trim() || createMutation.isPending}>Prijavi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
