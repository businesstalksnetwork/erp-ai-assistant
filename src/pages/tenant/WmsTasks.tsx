import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, Play, CheckCircle, AlertTriangle, Search, Clock, Loader2, AlertCircle } from "lucide-react";

const TASK_TYPES = ["receive", "putaway", "pick", "replenish", "move", "reslot", "count", "pack", "load"] as const;
const TASK_STATUSES = ["pending", "assigned", "in_progress", "completed", "cancelled", "exception"] as const;
type TaskType = typeof TASK_TYPES[number];
type TaskStatus = typeof TASK_STATUSES[number];

export default function WmsTasks() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<TaskType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [execDialog, setExecDialog] = useState<any>(null);
  const [exceptionReason, setExceptionReason] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["wms-tasks", tenantId, filterType, filterStatus],
    queryFn: async () => {
      let q = supabase.from("wms_tasks").select("*, products(name, sku), from_bin:wms_bins!wms_tasks_from_bin_id_fkey(code), to_bin:wms_bins!wms_tasks_to_bin_id_fkey(code), warehouses(name)").eq("tenant_id", tenantId!).order("priority").order("created_at", { ascending: false });
      if (filterType !== "all") q = q.eq("task_type", filterType as TaskType);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as TaskStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status, exception_reason }: { id: string; status: string; exception_reason?: string }) => {
      const updates: any = { status };
      if (status === "in_progress") updates.started_at = new Date().toISOString();
      if (status === "completed") updates.completed_at = new Date().toISOString();
      if (status === "exception") updates.exception_reason = exception_reason;
      if (status === "assigned") { updates.assigned_to = user?.id; updates.assigned_at = new Date().toISOString(); }
      const { error } = await supabase.from("wms_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-tasks"] }); toast({ title: t("success") }); setExecDialog(null); setExceptionReason(""); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline", assigned: "secondary", in_progress: "default", completed: "default", cancelled: "secondary", exception: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace("_", " ")}</Badge>;
  };

  const priorityLabel = (p: number) => {
    const labels = ["", "Urgent", "High", "Normal", "Low", "Lowest"];
    const colors = ["", "text-destructive", "text-orange-500", "text-foreground", "text-muted-foreground", "text-muted-foreground"];
    return <span className={`text-xs font-medium ${colors[p]}`}>{labels[p]}</span>;
  };

  const pending = tasks.filter((t: any) => t.status === "pending").length;
  const inProgress = tasks.filter((t: any) => t.status === "in_progress").length;
  const completedToday = tasks.filter((t: any) => t.status === "completed" && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString()).length;
  const exceptions = tasks.filter((t: any) => t.status === "exception").length;

  const filtered = tasks.filter((t: any) => {
    const s = search.toLowerCase();
    return t.task_number.toLowerCase().includes(s) || t.products?.name?.toLowerCase().includes(s) || t.products?.sku?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsTasks")} description={t("wmsTasksDesc")} icon={ClipboardCheck} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("pending")}</p><div className="mt-2 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-2xl font-bold">{pending}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("inProgress")}</p><div className="mt-2 flex items-center gap-2"><Loader2 className="h-4 w-4 text-primary" /><span className="text-2xl font-bold">{inProgress}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("completedToday")}</p><div className="mt-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /><span className="text-2xl font-bold">{completedToday}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("exceptions")}</p><div className="mt-2 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-2xl font-bold">{exceptions}</span></div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            {TASK_TYPES.map(tt => <SelectItem key={tt} value={tt}>{tt}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            {TASK_STATUSES.map(ts => <SelectItem key={ts} value={ts}>{ts.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("quantity")}</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="w-32">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
            ) : filtered.map((task: any) => (
              <TableRow key={task.id}>
                <TableCell className="font-mono text-xs">{task.task_number}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{task.task_type}</Badge></TableCell>
                <TableCell className="font-medium">{task.products?.name || "—"}</TableCell>
                <TableCell>{task.quantity ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{task.from_bin?.code || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{task.to_bin?.code || "—"}</TableCell>
                <TableCell>{statusBadge(task.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {task.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateTaskMutation.mutate({ id: task.id, status: "in_progress" })}>
                        <Play className="h-3 w-3 mr-1" />{t("startTask")}
                      </Button>
                    )}
                    {task.status === "in_progress" && (
                      <>
                        <Button size="sm" onClick={() => setExecDialog(task)}>
                          <CheckCircle className="h-3 w-3 mr-1" />{t("completeAction")}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setExecDialog({ ...task, _exception: true })}>
                          <AlertTriangle className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!execDialog} onOpenChange={() => setExecDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{execDialog?._exception ? t("reportException") : t("completeTask")}</DialogTitle></DialogHeader>
          {execDialog && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">#:</span> {execDialog.task_number}</div>
                <div><span className="text-muted-foreground">{t("type")}:</span> {execDialog.task_type}</div>
                <div><span className="text-muted-foreground">From:</span> {execDialog.from_bin?.code || "—"}</div>
                <div><span className="text-muted-foreground">To:</span> {execDialog.to_bin?.code || "—"}</div>
                <div><span className="text-muted-foreground">{t("product")}:</span> {execDialog.products?.name || "—"}</div>
                <div><span className="text-muted-foreground">{t("quantity")}:</span> {execDialog.quantity ?? "—"}</div>
              </div>
              {execDialog._exception && (
                <div>
                  <Label>{t("exceptionReason")}</Label>
                  <Textarea value={exceptionReason} onChange={e => setExceptionReason(e.target.value)} placeholder={t("describeIssue")} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecDialog(null)}>{t("cancel")}</Button>
            {execDialog?._exception ? (
              <Button variant="destructive" onClick={() => updateTaskMutation.mutate({ id: execDialog.id, status: "exception", exception_reason: exceptionReason })} disabled={!exceptionReason}>
                {t("reportException")}
              </Button>
            ) : (
              <Button onClick={() => updateTaskMutation.mutate({ id: execDialog?.id, status: "completed" })}>{t("confirmComplete")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
