import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShieldAlert, Bell, CheckCircle2, Clock } from "lucide-react";
import { format, differenceInHours, addHours } from "date-fns";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const INCIDENT_TYPES = [
  { value: "unauthorized_access", label: "Neovlašćen pristup / Unauthorized Access" },
  { value: "data_leak", label: "Curenje podataka / Data Leak" },
  { value: "brute_force", label: "Brute force napad / Brute Force" },
  { value: "anomaly", label: "Anomalija / Anomaly" },
];

const SEVERITIES = [
  { value: "low", label: "Nizak / Low", color: "secondary" as const },
  { value: "medium", label: "Srednji / Medium", color: "default" as const },
  { value: "high", label: "Visok / High", color: "destructive" as const },
  { value: "critical", label: "Kritičan / Critical", color: "destructive" as const },
];

const STATUSES = ["detected", "investigating", "notified", "resolved", "dismissed"] as const;

export default function SecurityIncidents() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    incident_type: "unauthorized_access",
    severity: "medium",
    title: "",
    description: "",
    affected_records: "0",
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["security-incidents", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("security_incidents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const addIncident = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const detectedAt = new Date().toISOString();
      const deadline = addHours(new Date(), 72).toISOString();
      const { error } = await supabase.from("security_incidents").insert({
        tenant_id: tenantId,
        incident_type: form.incident_type,
        severity: form.severity,
        title: form.title,
        description: form.description || null,
        affected_records: Number(form.affected_records) || 0,
        detected_at: detectedAt,
        notification_deadline: deadline,
        reported_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-incidents"] });
      toast({ title: t("success") });
      setAddOpen(false);
      setForm({ incident_type: "unauthorized_access", severity: "medium", title: "", description: "", affected_records: "0" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "notified") updates.notified_at = new Date().toISOString();
      if (status === "resolved") updates.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("security_incidents").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security-incidents"] }),
  });

  const severityBadge = (sev: string) => {
    const s = SEVERITIES.find(x => x.value === sev);
    return <Badge variant={s?.color || "default"}>{s?.label.split(" / ")[locale === "sr" ? 0 : 1] || sev}</Badge>;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      detected: "destructive",
      investigating: "secondary",
      notified: "default",
      resolved: "outline",
      dismissed: "outline",
    };
    return <Badge variant={colors[status] || "default"}>{status}</Badge>;
  };

  const deadlineWarning = (incident: any) => {
    if (!incident.notification_deadline || incident.status === "notified" || incident.status === "resolved" || incident.status === "dismissed") return null;
    const hoursLeft = differenceInHours(new Date(incident.notification_deadline), new Date());
    if (hoursLeft <= 0) return <Badge variant="destructive"><Clock className="h-3 w-3 mr-1" /> {locale === "sr" ? "Rok istekao!" : "Deadline passed!"}</Badge>;
    if (hoursLeft <= 24) return <Badge variant="destructive"><Clock className="h-3 w-3 mr-1" /> {hoursLeft}h</Badge>;
    return <span className="text-xs text-muted-foreground">{hoursLeft}h</span>;
  };

  const activeCount = incidents.filter((i: any) => i.status === "detected" || i.status === "investigating").length;
  const criticalCount = incidents.filter((i: any) => (i.severity === "critical" || i.severity === "high") && i.status !== "resolved" && i.status !== "dismissed").length;

  const columns: ResponsiveColumn<any>[] = [
    { key: "severity", label: locale === "sr" ? "Ozbiljnost" : "Severity", sortable: true, sortValue: (inc) => SEVERITIES.findIndex(s => s.value === inc.severity), render: (inc) => severityBadge(inc.severity) },
    { key: "title", label: locale === "sr" ? "Naslov" : "Title", primary: true, sortable: true, sortValue: (inc) => inc.title, render: (inc) => <span className="font-medium">{inc.title}</span> },
    { key: "type", label: locale === "sr" ? "Tip" : "Type", hideOnMobile: true, render: (inc) => INCIDENT_TYPES.find(t => t.value === inc.incident_type)?.label.split(" / ")[locale === "sr" ? 0 : 1] || inc.incident_type },
    { key: "status", label: t("status"), sortable: true, sortValue: (inc) => inc.status, render: (inc) => statusBadge(inc.status) },
    { key: "detected", label: locale === "sr" ? "Otkriveno" : "Detected", sortable: true, sortValue: (inc) => inc.detected_at, hideOnMobile: true, render: (inc) => format(new Date(inc.detected_at), "dd.MM.yyyy HH:mm") },
    { key: "deadline", label: locale === "sr" ? "Rok (72h)" : "Deadline", hideOnMobile: true, render: (inc) => deadlineWarning(inc) },
    { key: "actions", label: t("actions"), render: (inc) => (
      <div className="flex gap-1">
        {inc.status === "detected" && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: inc.id, status: "investigating" }); }}>
            {locale === "sr" ? "Istraži" : "Investigate"}
          </Button>
        )}
        {(inc.status === "detected" || inc.status === "investigating") && (
          <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: inc.id, status: "notified" }); }}>
            <Bell className="h-3 w-3 mr-1" /> {locale === "sr" ? "Obavesti" : "Notify"}
          </Button>
        )}
        {inc.status !== "resolved" && inc.status !== "dismissed" && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: inc.id, status: "resolved" }); }}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> {locale === "sr" ? "Reši" : "Resolve"}
          </Button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Bezbednosni incidenti" : "Security Incidents"}
        icon={ShieldAlert}
        description={locale === "sr" ? "ZZPL čl. 52 — obaveštavanje o povredi podataka u roku od 72 sata" : "PDPA Art. 52 — 72-hour breach notification requirement"}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{locale === "sr" ? "Aktivni incidenti" : "Active Incidents"}</p><p className="text-2xl font-bold">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{locale === "sr" ? "Kritični / Visoki" : "Critical / High"}</p><p className={`text-2xl font-bold ${criticalCount > 0 ? "text-destructive" : ""}`}>{criticalCount}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{locale === "sr" ? "Ukupno" : "Total"}</p><p className="text-2xl font-bold">{incidents.length}</p></CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {locale === "sr" ? "Prijavi incident" : "Report Incident"}
        </Button>
      </div>

      <ResponsiveTable
        data={incidents}
        columns={columns}
        keyExtractor={(inc) => inc.id}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="security_incidents"
        enableColumnToggle
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === "sr" ? "Prijava bezbednosnog incidenta" : "Report Security Incident"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{locale === "sr" ? "Tip incidenta" : "Incident Type"}</Label>
              <Select value={form.incident_type} onValueChange={v => setForm({ ...form, incident_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INCIDENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{locale === "sr" ? "Ozbiljnost" : "Severity"}</Label>
              <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{locale === "sr" ? "Naslov" : "Title"}</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={locale === "sr" ? "Kratak opis incidenta" : "Brief incident description"} />
            </div>
            <div>
              <Label>{locale === "sr" ? "Detaljan opis" : "Description"}</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>{locale === "sr" ? "Pogođeni zapisi" : "Affected Records"}</Label>
              <Input type="number" min="0" value={form.affected_records} onChange={e => setForm({ ...form, affected_records: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => addIncident.mutate()} disabled={!form.title || addIncident.isPending}>
              {addIncident.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
