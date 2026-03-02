import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const REQUEST_TYPES = ["access", "rectification", "erasure", "restriction", "portability", "objection"] as const;
const STATUSES = ["received", "identity_verification", "in_progress", "completed", "rejected"] as const;

export default function DsarManagement() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subject_name: "", subject_email: "", request_type: "access" as string, description: "" });

  const { data: requests = [] } = useQuery({
    queryKey: ["dsar_requests", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dsar_requests")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("received_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const num = `DSAR-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("dsar_requests").insert({
        tenant_id: tenantId!, request_number: num, ...form,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dsar_requests"] }); setCreateOpen(false); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "completed") updates.completed_date = new Date().toISOString();
      const { error } = await supabase.from("dsar_requests").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dsar_requests"] }); toast({ title: t("success") }); },
  });

  const overdue = requests.filter((r: any) => r.status !== "completed" && r.status !== "rejected" && r.deadline_date && new Date(r.deadline_date) < new Date()).length;
  const pending = requests.filter((r: any) => !["completed", "rejected"].includes(r.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dsarTitle")}</h1>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />{t("dsarNewRequest")}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{requests.length}</div><p className="text-sm text-muted-foreground">{t("dsarTotalRequests")}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{pending}</div><p className="text-sm text-muted-foreground">{t("dsarPending")}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-destructive">{overdue}</div><p className="text-sm text-muted-foreground">{t("dsarOverdueLimit")}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-green-600">{requests.filter((r: any) => r.status === "completed").length}</div><p className="text-sm text-muted-foreground">{t("dsarCompleted")}</p></CardContent></Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("dsarSubject")}</TableHead>
              <TableHead>{t("dsarType")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("dsarDeadline")}</TableHead>
              <TableHead>{t("dsarDaysLeft")}</TableHead>
              <TableHead>{t("dsarActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r: any) => {
              const daysLeft = r.deadline_date ? differenceInDays(new Date(r.deadline_date), new Date()) : null;
              const isOverdue = daysLeft !== null && daysLeft < 0 && !["completed", "rejected"].includes(r.status);
              const nextIdx = STATUSES.indexOf(r.status) + 1;
              const nextStatus = nextIdx < STATUSES.length ? STATUSES[nextIdx] : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                  <TableCell>{r.subject_name}</TableCell>
                  <TableCell><Badge variant="outline">{r.request_type}</Badge></TableCell>
                  <TableCell><Badge variant={r.status === "completed" ? "default" : isOverdue ? "destructive" : "secondary"}>{r.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell>{r.deadline_date ? format(new Date(r.deadline_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className={isOverdue ? "text-destructive font-bold" : ""}>{["completed", "rejected"].includes(r.status) ? "—" : daysLeft !== null ? `${daysLeft}d` : "—"}</TableCell>
                  <TableCell>
                    {nextStatus && !["completed", "rejected"].includes(r.status) && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: nextStatus })}>
                        → {nextStatus.replace(/_/g, " ")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {requests.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("dsarNoRequests")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("dsarNewRequestTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("dsarSubjectName")}</Label><Input value={form.subject_name} onChange={e => setForm(p => ({ ...p, subject_name: e.target.value }))} /></div>
            <div><Label>{t("dsarSubjectEmail")}</Label><Input type="email" value={form.subject_email} onChange={e => setForm(p => ({ ...p, subject_email: e.target.value }))} /></div>
            <div><Label>{t("dsarRequestType")}</Label>
              <Select value={form.request_type} onValueChange={v => setForm(p => ({ ...p, request_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REQUEST_TYPES.map(rt => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("dsarDescription")}</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <Button onClick={() => createMut.mutate()} disabled={!form.subject_name || createMut.isPending}>{t("dsarSubmitRequest")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
