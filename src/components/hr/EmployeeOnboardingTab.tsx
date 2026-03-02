import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Props {
  employeeId: string;
  tenantId: string;
}

interface ChecklistItem {
  title: string;
  description?: string;
}

export function EmployeeOnboardingTab({ employeeId, tenantId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["employee-onboarding-tasks", employeeId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("employee_onboarding_tasks" as any)
        .select("*, onboarding_checklists(name, items)")
        .eq("employee_id", employeeId)
        .eq("tenant_id", tenantId)
        .order("checklist_id")
        .order("item_index") as any);
      return data || [];
    },
  });

  const { data: checklists = [] } = useQuery({
    queryKey: ["onboarding-checklists", tenantId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("onboarding_checklists" as any)
        .select("id, name, items")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name") as any);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const assignMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      const checklist = checklists.find((c: any) => c.id === checklistId);
      if (!checklist) throw new Error("Checklist not found");
      const items = (checklist as any).items as ChecklistItem[];
      const rows = items.map((_: ChecklistItem, idx: number) => ({
        tenant_id: tenantId, employee_id: employeeId, checklist_id: checklistId, item_index: idx, completed: false,
      }));
      const { error } = await (supabase.from("employee_onboarding_tasks" as any).insert(rows) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-onboarding-tasks", employeeId] });
      setAssignOpen(false);
      setSelectedChecklist("");
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await (supabase
        .from("employee_onboarding_tasks" as any)
        .update({ completed, completed_at: completed ? new Date().toISOString() : null, completed_by: completed ? user?.id : null })
        .eq("id", taskId) as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-onboarding-tasks", employeeId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = tasks.reduce((acc: Record<string, any[]>, task: any) => {
    const key = task.checklist_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("onboardingChecklists")}</h3>
        <Button size="sm" onClick={() => setAssignOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />{t("assignChecklist")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t("noOnboardingTasks")}</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([checklistId, checklistTasks]) => {
          const completedCount = (checklistTasks as any[]).filter((t: any) => t.completed).length;
          const totalCount = (checklistTasks as any[]).length;
          const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const checklistName = (checklistTasks as any[])[0]?.onboarding_checklists?.name || "—";
          const items = ((checklistTasks as any[])[0]?.onboarding_checklists?.items || []) as ChecklistItem[];

          return (
            <Card key={checklistId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{checklistName}</span>
                  <span className="text-sm font-normal text-muted-foreground">{completedCount}/{totalCount}</span>
                </CardTitle>
                <Progress value={pct} className="h-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(checklistTasks as any[]).map((task: any) => {
                    const item = items[task.item_index] || { title: `Item ${task.item_index + 1}` };
                    return (
                      <div key={task.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked) => toggleMutation.mutate({ taskId: task.id, completed: !!checked })}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</p>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assignChecklist")}</DialogTitle>
          </DialogHeader>
          <Select value={selectedChecklist} onValueChange={setSelectedChecklist}>
            <SelectTrigger>
              <SelectValue placeholder={t("selectChecklist")} />
            </SelectTrigger>
            <SelectContent>
              {checklists.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => assignMutation.mutate(selectedChecklist)} disabled={!selectedChecklist || assignMutation.isPending}>
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
