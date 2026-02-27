import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ListTodo, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DailyTask {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

export function DailyTasksWidget() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const qk = ["daily-tasks", tenantId, today];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data } = await supabase
        .from("user_daily_tasks")
        .select("id, title, is_completed, sort_order")
        .eq("tenant_id", tenantId!)
        .eq("user_id", session.user.id)
        .eq("task_date", today)
        .order("sort_order")
        .order("created_at");
      return (data || []) as DailyTask[];
    },
    enabled: !!tenantId,
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { error } = await supabase.from("user_daily_tasks").insert({
        user_id: session.user.id,
        tenant_id: tenantId!,
        title: newTitle.trim(),
        task_date: today,
        sort_order: tasks.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      setNewTitle("");
    },
    onError: () => toast.error(t("error")),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("user_daily_tasks").update({ is_completed: completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_daily_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">{t("dailyTasks")}</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{completedCount}/{tasks.length}</span>
        </div>
        {tasks.length > 0 && (
          <Progress value={progress} className="h-1.5 mt-1" />
        )}
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
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => newTitle.trim() && addTask.mutate()} disabled={!newTitle.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto space-y-0.5">
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
            <p className="text-xs text-muted-foreground text-center py-4">{t("noDailyTasks")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
