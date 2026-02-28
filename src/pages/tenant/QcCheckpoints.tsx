import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ClipboardCheck, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

export default function QcCheckpoints() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inspectDialog, setInspectDialog] = useState<any>(null);
  const [inspectResult, setInspectResult] = useState<"passed" | "failed">("passed");
  const [inspectNotes, setInspectNotes] = useState("");
  const [inspectDefects, setInspectDefects] = useState(0);
  const [form, setForm] = useState({ production_order_id: "", stage_name: "", stage_order: 1, pass_criteria: "" });

  const { data: orders = [] } = useQuery({
    queryKey: ["production-orders-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("production_orders").select("id, order_number").eq("tenant_id", tenantId!).in("status", ["planned", "in_progress"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: checkpoints = [], isLoading } = useQuery({
    queryKey: ["qc-checkpoints", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("qc_checkpoints") as any).select("*, production_orders(order_number)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("qc_checkpoints") as any).insert({ ...form, tenant_id: tenantId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qc-checkpoints"] }); setOpen(false); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const inspectMutation = useMutation({
    mutationFn: async () => {
      if (!inspectDialog) return;
      const { error } = await (supabase.from("qc_checkpoints") as any).update({
        status: inspectResult,
        inspector_id: user?.id,
        inspected_at: new Date().toISOString(),
        result: inspectResult,
        notes: inspectNotes || null,
        defects_found: inspectDefects,
      }).eq("id", inspectDialog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qc-checkpoints"] });
      setInspectDialog(null);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const pending = checkpoints.filter((c: any) => c.status === "pending").length;
  const passed = checkpoints.filter((c: any) => c.status === "passed").length;
  const failed = checkpoints.filter((c: any) => c.status === "failed").length;

  const stats = [
    { label: t("total"), value: checkpoints.length, icon: ClipboardCheck, color: "text-primary" },
    { label: t("qcPending"), value: pending, icon: Clock, color: "text-yellow-600" },
    { label: t("qcPassed"), value: passed, icon: CheckCircle, color: "text-green-600" },
    { label: t("qcFailed"), value: failed, icon: XCircle, color: "text-destructive" },
  ];

  const statusBadge = (s: string) => {
    const v: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "secondary", in_progress: "outline", passed: "default", failed: "destructive", waived: "outline" };
    const label: Record<string, string> = { pending: t("qcPending"), passed: t("qcPassed"), failed: t("qcFailed"), waived: t("qcWaived"), in_progress: t("inProgress" as any) || "In Progress" };
    return <Badge variant={v[s] || "secondary"}>{label[s] || s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("qcCheckpoints")} description={t("qcCheckpoints")} icon={ClipboardCheck}
        actions={<Button onClick={() => { setForm({ production_order_id: "", stage_name: "", stage_order: 1, pass_criteria: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>} />

      <StatsBar stats={stats} />

      <Card>
        <CardHeader><CardTitle>{t("qcCheckpoints")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("productionOrders" as any) || "Order"}</TableHead>
                <TableHead>{t("stageName")}</TableHead>
                <TableHead>#</TableHead>
                <TableHead>{t("passCriteria")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("defectUnits")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checkpoints.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : checkpoints.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.production_orders?.order_number || "—"}</TableCell>
                  <TableCell className="font-medium">{c.stage_name}</TableCell>
                  <TableCell>{c.stage_order}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{c.pass_criteria || "—"}</TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell>{c.defects_found || 0}</TableCell>
                  <TableCell>
                    {c.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => { setInspectDialog(c); setInspectResult("passed"); setInspectNotes(""); setInspectDefects(0); }}>
                        {t("inspector") || "Inspect"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("add")} {t("qcCheckpoints")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>{t("productionOrders" as any) || "Order"} *</Label>
              <Select value={form.production_order_id} onValueChange={(v) => setForm({ ...form, production_order_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{orders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("stageName")} *</Label><Input value={form.stage_name} onChange={(e) => setForm({ ...form, stage_name: e.target.value })} /></div>
              <div><Label>Stage #</Label><Input type="number" value={form.stage_order} onChange={(e) => setForm({ ...form, stage_order: +e.target.value })} /></div>
            </div>
            <div><Label>{t("passCriteria")}</Label><Textarea value={form.pass_criteria} onChange={(e) => setForm({ ...form, pass_criteria: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.production_order_id || !form.stage_name || createMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect dialog */}
      <Dialog open={!!inspectDialog} onOpenChange={() => setInspectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("inspector")} — {inspectDialog?.stage_name}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>{t("result" as any) || "Result"}</Label>
              <Select value={inspectResult} onValueChange={(v) => setInspectResult(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">{t("qcPassed")}</SelectItem>
                  <SelectItem value="failed">{t("qcFailed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("defectUnits")}</Label><Input type="number" value={inspectDefects} onChange={(e) => setInspectDefects(+e.target.value)} /></div>
            <div><Label>{t("notes")}</Label><Textarea value={inspectNotes} onChange={(e) => setInspectNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectDialog(null)}>{t("cancel")}</Button>
            <Button onClick={() => inspectMutation.mutate()} disabled={inspectMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
