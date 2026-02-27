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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, Bell, Calendar } from "lucide-react";
import { toast } from "sonner";

interface UserTask {
  id: string;
  title: string;
  is_completed: boolean;
  due_date: string | null;
  priority: string;
  reminder_at: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  created_at: string;
}

export function PersonalTasksWidget() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");

  const qk = ["user-tasks", tenantId];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data } = await supabase
        .from("user_tasks")
        .select("id, title, is_completed, due_date, priority, reminder_at, linked_entity_type, linked_entity_id, created_at")
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
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const priorityColor: Record<string, string> = {
    high: "text-destructive",
    medium: "text-warning",
    low: "text-muted-foreground",
  };

  const completedCount = tasks.filter(t => t.is_completed).length;

  return (
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
              <span className={`text-xs flex-1 ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </span>
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
  );
}
