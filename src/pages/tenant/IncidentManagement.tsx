/**
 * ITSM-02: Incident Management Page
 * ISO 20000 — Incident tracking, severity, resolution.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertOctagon, Clock, CheckCircle, XCircle } from "lucide-react";

export default function IncidentManagement() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", category: "general", impact: "" });
  const [resolveForm, setResolveForm] = useState({ resolution_notes: "", root_cause: "" });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("incidents").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const year = new Date().getFullYear();
      const count = incidents.filter((i: any) => i.incident_number?.startsWith(`INC-${year}`)).length + 1;
      await supabase.from("incidents").insert({
        tenant_id: tenantId,
        incident_number: `INC-${year}/${String(count).padStart(4, "0")}`,
        title: form.title,
        description: form.description || null,
        severity: form.severity,
        category: form.category,
        impact: form.impact || null,
        reported_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setCreateOpen(false);
      setForm({ title: "", description: "", severity: "medium", category: "general", impact: "" });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIncident) return;
      await supabase.from("incidents").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_notes: resolveForm.resolution_notes || null,
        root_cause: resolveForm.root_cause || null,
      }).eq("id", selectedIncident.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setResolveOpen(false);
      setSelectedIncident(null);
      setResolveForm({ resolution_notes: "", root_cause: "" });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("incidents").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
    toast({ title: t("success") });
  };

  const openCount = incidents.filter((i: any) => i.status === "open").length;
  const inProgressCount = incidents.filter((i: any) => i.status === "in_progress").length;
  const criticalCount = incidents.filter((i: any) => i.severity === "critical" && i.status !== "resolved" && i.status !== "closed").length;

  const severityBadge = (s: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "secondary", medium: "outline", high: "default", critical: "destructive",
    };
    return <Badge variant={map[s] || "outline"}>{s}</Badge>;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "destructive", in_progress: "outline", resolved: "default", closed: "secondary",
    };
    return <Badge variant={map[s] || "outline"}>{s.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{"Incident Management"}</h1>
          <p className="text-sm text-muted-foreground">ISO 20000 — Track, resolve, and analyze incidents</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />{"Report Incident"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertOctagon className="h-4 w-4 text-destructive" />Open</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{openCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />In Progress</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inProgressCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" />Critical</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{criticalCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" />Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{incidents.length}</p></CardContent></Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{"#"}</TableHead>
            <TableHead>{t("title")}</TableHead>
            <TableHead>{"Severity"}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{"Category"}</TableHead>
            <TableHead>{t("createdAt")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((inc: any) => (
            <TableRow key={inc.id}>
              <TableCell className="font-mono text-sm">{inc.incident_number}</TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">{inc.title}</TableCell>
              <TableCell>{severityBadge(inc.severity)}</TableCell>
              <TableCell>{statusBadge(inc.status)}</TableCell>
              <TableCell><Badge variant="outline">{inc.category}</Badge></TableCell>
              <TableCell className="text-sm">{new Date(inc.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {inc.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(inc.id, "in_progress")}>{"Start"}</Button>
                  )}
                  {(inc.status === "open" || inc.status === "in_progress") && (
                    <Button size="sm" variant="default" onClick={() => { setSelectedIncident(inc); setResolveOpen(true); }}>{"Resolve"}</Button>
                  )}
                  {inc.status === "resolved" && (
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(inc.id, "closed")}>{"Close"}</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {incidents.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
        </TableBody>
      </Table>

      {/* Create Incident Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{"Report Incident"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("title")}</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{"Severity"}</Label>
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
              <div>
                <Label>{"Category"}</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="data">Data</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{"Impact"}</Label><Textarea value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))} placeholder="Describe the business impact..." /></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!form.title}>{"Report"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Incident Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{"Resolve Incident"}{selectedIncident ? `: ${selectedIncident.incident_number}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{"Resolution Notes"}</Label><Textarea value={resolveForm.resolution_notes} onChange={e => setResolveForm(f => ({ ...f, resolution_notes: e.target.value }))} /></div>
            <div><Label>{"Root Cause"}</Label><Textarea value={resolveForm.root_cause} onChange={e => setResolveForm(f => ({ ...f, root_cause: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => resolveMutation.mutate()}>{"Resolve"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
