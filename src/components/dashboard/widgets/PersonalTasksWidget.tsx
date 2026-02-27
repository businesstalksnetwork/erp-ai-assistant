import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, Trash2, Bell, Calendar, Link2, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

interface UserTask {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
  priority: string;
  reminder_at: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  created_at: string;
}

const ENTITY_TYPES = [
  { value: "invoice", labelKey: "invoice", path: "/invoices" },
  { value: "partner", labelKey: "partner", path: "/partners" },
  { value: "employee", labelKey: "employee", path: "/employees" },
  { value: "product", labelKey: "product", path: "/products" },
  { value: "opportunity", labelKey: "opportunity", path: "/opportunities" },
  { value: "lead", labelKey: "lead", path: "/leads" },
];

export function PersonalTasksWidget() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [selectedTask, setSelectedTask] = useState<UserTask | null>(null);
  const [editValues, setEditValues] = useState<Partial<UserTask>>({});

  const qk = ["user-tasks", tenantId];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data } = await supabase
        .from("user_tasks")
        .select("id, title, description, is_completed, due_date, priority, reminder_at, linked_entity_type, linked_entity_id, created_at")
        .eq("tenant_id", tenantId!)
        .eq("user_id", session.user.id)
        .order("is_completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as UserTask[];
    },
    enabled: !!tenantId,
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { error } = await supabase.from("user_tasks").insert({
        user_id: session.user.id,
        tenant_id: tenantId!,
        title: newTitle.trim(),
        priority: newPriority,
        due_date: newDueDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      setNewTitle("");
      setNewDueDate("");
    },
    onError: () => toast.error(t("error")),
  });

  const updateTask = useMutation({
    mutationFn: async (updates: Partial<UserTask> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from("user_tasks").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("error")),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("user_tasks").update({ is_completed: completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      setSelectedTask(null);
    },
  });

  const priorityColor: Record<string, string> = {
    high: "text-destructive",
    medium: "text-warning",
    low: "text-muted-foreground",
  };

  const completedCount = tasks.filter(t => t.is_completed).length;

  const openTaskDetail = (task: UserTask) => {
    setSelectedTask(task);
    setEditValues({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      due_date: task.due_date || "",
      reminder_at: task.reminder_at ? task.reminder_at.slice(0, 16) : "",
      linked_entity_type: task.linked_entity_type || "",
      linked_entity_id: task.linked_entity_id || "",
    });
  };

  const saveTaskEdits = () => {
    if (!selectedTask) return;
    const updates: Partial<UserTask> & { id: string } = {
      id: selectedTask.id,
      title: editValues.title,
      description: editValues.description || null,
      priority: editValues.priority as UserTask["priority"],
      due_date: editValues.due_date || null,
      reminder_at: editValues.reminder_at ? new Date(editValues.reminder_at).toISOString() : null,
      linked_entity_type: editValues.linked_entity_type || null,
      linked_entity_id: editValues.linked_entity_id || null,
    };
    updateTask.mutate(updates);
    setSelectedTask(null);
  };

  const getEntityLink = (type: string, id: string) => {
    const et = ENTITY_TYPES.find(e => e.value === type);
    return et ? `${et.path}/${id}` : "#";
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">{t("personalTasks")}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{tasks.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-2 overflow-hidden">
          {/* Add form */}
          <div className="flex gap-1.5">
            <Input
              placeholder={t("addTask")}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && newTitle.trim() && addTask.mutate()}
              className="h-8 text-xs"
            />
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">🔴</SelectItem>
                <SelectItem value="medium">🟡</SelectItem>
                <SelectItem value="low">🟢</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="w-28 h-8 text-xs"
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => newTitle.trim() && addTask.mutate()} disabled={!newTitle.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {isLoading && <div className="text-xs text-muted-foreground">{t("loading")}</div>}
            {tasks.map(task => (
              <div key={task.id} className={`flex items-center gap-2 py-1 px-1.5 rounded hover:bg-muted/50 group ${task.is_completed ? "opacity-50" : ""}`}>
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={(v) => toggleTask.mutate({ id: task.id, completed: !!v })}
                />
                <button
                  className={`text-xs flex-1 text-left truncate hover:underline cursor-pointer ${task.is_completed ? "line-through text-muted-foreground" : ""}`}
                  onClick={() => openTaskDetail(task)}
                >
                  {task.title}
                </button>
                {task.linked_entity_type && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    <Link2 className="h-2.5 w-2.5 mr-0.5" />
                    {t(task.linked_entity_type as any)}
                  </Badge>
                )}
                <span className={`text-[10px] ${priorityColor[task.priority]}`}>●</span>
                {task.due_date && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
                {task.reminder_at && <Bell className="h-3 w-3 text-primary" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={() => deleteTask.mutate(task.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {!isLoading && tasks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">{t("noTasks")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task detail dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t("taskDetails")}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">{t("title")}</Label>
                <Input
                  value={editValues.title || ""}
                  onChange={e => setEditValues(v => ({ ...v, title: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t("description")}</Label>
                <Textarea
                  value={(editValues.description as string) || ""}
                  onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                  className="mt-1 min-h-[60px]"
                  placeholder={t("description")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t("priority")}</Label>
                  <Select value={editValues.priority || "medium"} onValueChange={v => setEditValues(prev => ({ ...prev, priority: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">🔴 High</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="low">🟢 Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("dueDate")}</Label>
                  <Input
                    type="date"
                    value={(editValues.due_date as string) || ""}
                    onChange={e => setEditValues(v => ({ ...v, due_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Reminder */}
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Bell className="h-3 w-3" /> {t("reminderAt")}
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="datetime-local"
                    value={(editValues.reminder_at as string) || ""}
                    onChange={e => setEditValues(v => ({ ...v, reminder_at: e.target.value }))}
                    className="flex-1"
                  />
                  {editValues.reminder_at && (
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditValues(v => ({ ...v, reminder_at: "" }))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Entity linking */}
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> {t("linkEntity")}
                </Label>
                <div className="flex gap-2 mt-1">
                  <Select
                    value={(editValues.linked_entity_type as string) || "none"}
                    onValueChange={v => setEditValues(prev => ({ ...prev, linked_entity_type: v === "none" ? "" : v, linked_entity_id: v === "none" ? "" : prev.linked_entity_id }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder={t("entityType")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {ENTITY_TYPES.map(et => (
                        <SelectItem key={et.value} value={et.value}>{t(et.labelKey as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editValues.linked_entity_type && (
                    <Input
                      placeholder="ID"
                      value={(editValues.linked_entity_id as string) || ""}
                      onChange={e => setEditValues(v => ({ ...v, linked_entity_id: e.target.value }))}
                      className="flex-1"
                    />
                  )}
                </div>
                {selectedTask.linked_entity_type && selectedTask.linked_entity_id && (
                  <a
                    href={getEntityLink(selectedTask.linked_entity_type, selectedTask.linked_entity_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("linkedTo")}: {t(selectedTask.linked_entity_type as any)}
                  </a>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="destructive" size="sm" onClick={() => deleteTask.mutate(selectedTask.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("delete")}
                </Button>
                <Button size="sm" onClick={saveTaskEdits}>
                  {t("save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
