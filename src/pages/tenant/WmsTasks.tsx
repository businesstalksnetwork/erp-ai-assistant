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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, Play, CheckCircle, AlertTriangle, Search, Clock, Loader2, AlertCircle, Plus, Users, Zap } from "lucide-react";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Create task form state
  const [newTask, setNewTask] = useState({
    task_type: "move" as TaskType,
    warehouse_id: "",
    product_id: "",
    from_bin_id: "",
    to_bin_id: "",
    quantity: 1,
    priority: 3,
    notes: "",
  });

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

  const { data: warehouses = [] } = useQuery({
    queryKey: ["wms-warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["wms-products", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku").eq("tenant_id", tenantId!).limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: allBins = [] } = useQuery({
    queryKey: ["wms-all-bins", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bins").select("id, code, zone_id, wms_zones(warehouse_id)").eq("tenant_id", tenantId!).limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["wms-members", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenant_members").select("user_id, role").eq("tenant_id", tenantId!).eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status, exception_reason, assigned_to, priority }: { id: string; status?: string; exception_reason?: string; assigned_to?: string; priority?: number }) => {
      const updates: any = {};
      if (status) {
        updates.status = status;
        if (status === "in_progress") updates.started_at = new Date().toISOString();
        if (status === "completed") updates.completed_at = new Date().toISOString();
        if (status === "exception") updates.exception_reason = exception_reason;
        if (status === "assigned") { updates.assigned_to = assigned_to || user?.id; updates.assigned_at = new Date().toISOString(); }
      }
      if (assigned_to) { updates.assigned_to = assigned_to; updates.assigned_at = new Date().toISOString(); if (!status) updates.status = "assigned"; }
      if (priority !== undefined) updates.priority = priority;
      const { error } = await supabase.from("wms_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-tasks"] }); toast({ title: t("success") }); setExecDialog(null); setExceptionReason(""); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const count = await supabase.from("wms_tasks").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!);
      const seq = (count.count || 0) + 1;
      const { error } = await supabase.from("wms_tasks").insert({
        tenant_id: tenantId!,
        task_number: `TASK-${String(seq).padStart(5, "0")}`,
        task_type: newTask.task_type,
        warehouse_id: newTask.warehouse_id || null,
        product_id: newTask.product_id || null,
        from_bin_id: newTask.from_bin_id || null,
        to_bin_id: newTask.to_bin_id || null,
        quantity: newTask.quantity,
        priority: newTask.priority,
        notes: newTask.notes || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-tasks"] });
      toast({ title: t("success") });
      setCreateOpen(false);
      setNewTask({ task_type: "move", warehouse_id: "", product_id: "", from_bin_id: "", to_bin_id: "", quantity: 1, priority: 3, notes: "" });
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const batchMutation = useMutation({
    mutationFn: async ({ action, assignTo }: { action: "start" | "cancel" | "assign"; assignTo?: string }) => {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        const updates: any = {};
        if (action === "start") { updates.status = "in_progress"; updates.started_at = new Date().toISOString(); }
        if (action === "cancel") { updates.status = "cancelled"; }
        if (action === "assign") { updates.status = "assigned"; updates.assigned_to = assignTo || user?.id; updates.assigned_at = new Date().toISOString(); }
        await supabase.from("wms_tasks").update(updates).eq("id", id);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-tasks"] }); toast({ title: t("success") }); setSelectedIds(new Set()); },
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

  // Performance metrics
  const completedTasks = tasks.filter((t: any) => t.status === "completed" && t.started_at && t.completed_at);
  const avgCompletionMin = completedTasks.length > 0
    ? Math.round(completedTasks.reduce((sum: number, t: any) => sum + (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60000, 0) / completedTasks.length)
    : 0;

  const filtered = tasks.filter((t: any) => {
    const s = search.toLowerCase();
    return t.task_number.toLowerCase().includes(s) || t.products?.name?.toLowerCase().includes(s) || t.products?.sku?.toLowerCase().includes(s);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((t: any) => t.id)));
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsTasks")} description={t("wmsTasksDesc")} icon={ClipboardCheck} />

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("pending")}</p><div className="mt-2 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-2xl font-bold">{pending}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("wmsInProgress")}</p><div className="mt-2 flex items-center gap-2"><Loader2 className="h-4 w-4 text-primary" /><span className="text-2xl font-bold">{inProgress}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("completedToday")}</p><div className="mt-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /><span className="text-2xl font-bold">{completedToday}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("exceptions")}</p><div className="mt-2 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-2xl font-bold">{exceptions}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("avgCompletionTime")}</p><div className="mt-2 flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><span className="text-2xl font-bold">{avgCompletionMin}m</span></div></CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("wmsAllTypes")}</SelectItem>
            {TASK_TYPES.map(tt => <SelectItem key={tt} value={tt}>{tt}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("wmsAllStatuses")}</SelectItem>
            {TASK_STATUSES.map(ts => <SelectItem key={ts} value={ts}>{ts.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => batchMutation.mutate({ action: "start" })}>
                <Play className="h-3 w-3 mr-1" />{t("batchStart")} ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => batchMutation.mutate({ action: "assign" })}>
                <Users className="h-3 w-3 mr-1" />{t("batchAssign")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => batchMutation.mutate({ action: "cancel" })}>
                {t("batchCancel")} ({selectedIds.size})
              </Button>
            </>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t("createTask")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>#</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("quantity")}</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>{t("priority")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="w-40">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
            ) : filtered.map((task: any) => (
              <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailTask(task)}>
                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.has(task.id)} onCheckedChange={() => toggleSelect(task.id)} /></TableCell>
                <TableCell className="font-mono text-xs">{task.task_number}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{task.task_type}</Badge></TableCell>
                <TableCell className="font-medium">{task.products?.name || "—"}</TableCell>
                <TableCell>{task.quantity ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{task.from_bin?.code || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{task.to_bin?.code || "—"}</TableCell>
                <TableCell>
                  <Select value={String(task.priority)} onValueChange={v => { updateTaskMutation.mutate({ id: task.id, priority: Number(v) }); }} >
                    <SelectTrigger className="h-7 w-20 text-xs" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(p => <SelectItem key={p} value={String(p)}>{["", "Urgent", "High", "Normal", "Low", "Lowest"][p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{statusBadge(task.status)}</TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
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

      {/* Complete/Exception Dialog */}
      <Dialog open={!!execDialog} onOpenChange={() => setExecDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{execDialog?._exception ? t("reportException") : t("completeTask")}</DialogTitle></DialogHeader>
          {execDialog && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("createTask")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("type")}</Label>
                <Select value={newTask.task_type} onValueChange={v => setNewTask(p => ({ ...p, task_type: v as TaskType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_TYPES.map(tt => <SelectItem key={tt} value={tt}>{tt}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("warehouse")}</Label>
                <Select value={newTask.warehouse_id} onValueChange={v => setNewTask(p => ({ ...p, warehouse_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("product")}</Label>
              <Select value={newTask.product_id} onValueChange={v => setNewTask(p => ({ ...p, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Bin</Label>
                <Select value={newTask.from_bin_id} onValueChange={v => setNewTask(p => ({ ...p, from_bin_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{allBins.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>To Bin</Label>
                <Select value={newTask.to_bin_id} onValueChange={v => setNewTask(p => ({ ...p, to_bin_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{allBins.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("quantity")}</Label>
                <Input type="number" min={1} value={newTask.quantity} onChange={e => setNewTask(p => ({ ...p, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>{t("priority")}</Label>
                <Select value={String(newTask.priority)} onValueChange={v => setNewTask(p => ({ ...p, priority: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(p => <SelectItem key={p} value={String(p)}>{["", "Urgent", "High", "Normal", "Low", "Lowest"][p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea value={newTask.notes} onChange={e => setNewTask(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createTaskMutation.mutate()} disabled={createTaskMutation.isPending}>{t("createTask")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Side Panel */}
      <Sheet open={!!detailTask} onOpenChange={() => setDetailTask(null)}>
        <SheetContent className="w-[400px] sm:w-[500px]">
          <SheetHeader><SheetTitle>{t("taskDetails")} — {detailTask?.task_number}</SheetTitle></SheetHeader>
          {detailTask && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{t("type")}:</span><br/><Badge variant="outline">{detailTask.task_type}</Badge></div>
                <div><span className="text-muted-foreground">{t("status")}:</span><br/>{statusBadge(detailTask.status)}</div>
                <div><span className="text-muted-foreground">{t("priority")}:</span><br/>{priorityLabel(detailTask.priority)}</div>
                <div><span className="text-muted-foreground">{t("warehouse")}:</span><br/>{detailTask.warehouses?.name || "—"}</div>
                <div><span className="text-muted-foreground">{t("product")}:</span><br/>{detailTask.products?.name || "—"}</div>
                <div><span className="text-muted-foreground">{t("quantity")}:</span><br/>{detailTask.quantity ?? "—"}</div>
                <div><span className="text-muted-foreground">From:</span><br/><span className="font-mono">{detailTask.from_bin?.code || "—"}</span></div>
                <div><span className="text-muted-foreground">To:</span><br/><span className="font-mono">{detailTask.to_bin?.code || "—"}</span></div>
              </div>
              <div className="border-t pt-4 space-y-2 text-sm">
                <p><span className="text-muted-foreground">{t("createdAt")}:</span> {new Date(detailTask.created_at).toLocaleString()}</p>
                {detailTask.assigned_at && <p><span className="text-muted-foreground">{t("assignedAt")}:</span> {new Date(detailTask.assigned_at).toLocaleString()}</p>}
                {detailTask.started_at && <p><span className="text-muted-foreground">{t("startedAt")}:</span> {new Date(detailTask.started_at).toLocaleString()}</p>}
                {detailTask.completed_at && <p><span className="text-muted-foreground">{t("completedAt")}:</span> {new Date(detailTask.completed_at).toLocaleString()}</p>}
                {detailTask.exception_reason && <p><span className="text-destructive">{t("exceptionReason")}:</span> {detailTask.exception_reason}</p>}
                {detailTask.notes && <p><span className="text-muted-foreground">{t("notes")}:</span> {detailTask.notes}</p>}
              </div>

              {/* Worker Assignment */}
              {(detailTask.status === "pending" || detailTask.status === "assigned") && (
                <div className="border-t pt-4">
                  <Label>{t("assignWorker")}</Label>
                  <Select onValueChange={v => updateTaskMutation.mutate({ id: detailTask.id, assigned_to: v })}>
                    <SelectTrigger><SelectValue placeholder={t("selectWorker")} /></SelectTrigger>
                    <SelectContent>
                      {members.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.user_id.slice(0, 8)}... ({m.role})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
