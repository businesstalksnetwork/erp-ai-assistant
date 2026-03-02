import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, CheckCircle, Clock, Shield } from "lucide-react";
import { format } from "date-fns";

const STATUSES = ["open", "in_progress", "implemented", "verification_pending", "verified", "closed"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const STATUS_COLORS: Record<string, string> = {
  open: "destructive", in_progress: "default", implemented: "secondary",
  verification_pending: "outline", verified: "default", closed: "secondary",
};

export default function CapaManagement() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", source_type: "incident" });

  const { data: items = [] } = useQuery({
    queryKey: ["capa_actions", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("capa_actions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("capa_actions").insert({
        tenant_id: tenantId!, ...form,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["capa_actions"] }); setCreateOpen(false); setForm({ title: "", description: "", severity: "medium", source_type: "incident" }); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "closed") updates.completed_date = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("capa_actions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["capa_actions"] }); toast({ title: t("success") }); },
  });

  const byStatus = STATUSES.reduce((acc, s) => ({ ...acc, [s]: items.filter((i: any) => i.status === s).length }), {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CAPA Management (ISO 9001 / QM-03)</h1>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />New CAPA</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-destructive">{byStatus.open || 0}</div><p className="text-sm text-muted-foreground">Open</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{byStatus.in_progress || 0}</div><p className="text-sm text-muted-foreground">In Progress</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{byStatus.verification_pending || 0}</div><p className="text-sm text-muted-foreground">Pending Verification</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-green-600">{byStatus.closed || 0}</div><p className="text-sm text-muted-foreground">Closed</p></CardContent></Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Target Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: any) => {
              const nextStatus = STATUSES[STATUSES.indexOf(item.status) + 1];
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell><Badge variant={item.severity === "critical" ? "destructive" : "outline"}>{item.severity}</Badge></TableCell>
                  <TableCell><Badge variant={STATUS_COLORS[item.status] as any || "outline"}>{item.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell>{item.target_date || "—"}</TableCell>
                  <TableCell>
                    {nextStatus && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: item.id, status: nextStatus })}>
                        → {nextStatus.replace(/_/g, " ")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No CAPA actions</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New CAPA Action</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(p => ({ ...p, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending}>Create CAPA</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
