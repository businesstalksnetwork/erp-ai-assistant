import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanSquare, ChevronRight, GripVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";

const COLUMNS = [
  { key: "draft", label: "Draft", color: "bg-muted" },
  { key: "planned", label: "Planned", color: "bg-blue-500/10" },
  { key: "in_progress", label: "In Progress", color: "bg-amber-500/10" },
  { key: "completed", label: "Completed", color: "bg-green-500/10" },
] as const;

export default function ProductionKanban() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dragItem, setDragItem] = useState<string | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["production-kanban", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*, products(name), bom_templates(name)")
        .eq("tenant_id", tenantId!)
        .not("status", "eq", "cancelled")
        .order("priority")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const extra: Record<string, any> = {};
      if (status === "in_progress") extra.actual_start = new Date().toISOString().split("T")[0];
      if (status === "completed") extra.actual_end = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("production_orders").update({ status, ...extra }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-kanban"] });
      toast({ title: t("success") });
    },
  });

  const handleDrop = (targetStatus: string) => {
    if (!dragItem) return;
    const order = orders.find((o: any) => o.id === dragItem);
    if (!order || order.status === targetStatus) return;
    // Only allow forward transitions
    const statusOrder = ["draft", "planned", "in_progress", "completed"];
    const fromIdx = statusOrder.indexOf(order.status);
    const toIdx = statusOrder.indexOf(targetStatus);
    if (toIdx <= fromIdx && targetStatus !== "draft") return;
    moveMutation.mutate({ id: dragItem, status: targetStatus });
    setDragItem(null);
  };

  const priorityColor = (p: number) => {
    if (p <= 1) return "destructive";
    if (p <= 2) return "default";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Kanban tabla" : "Production Kanban"}
        description={locale === "sr" ? "Vizuelni pregled statusa radnih naloga" : "Visual production order workflow"}
        icon={KanbanSquare}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[60vh]">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o: any) => o.status === col.key);
          return (
            <div
              key={col.key}
              className={`rounded-lg border-2 border-dashed p-3 ${col.color} transition-colors`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{t(col.key as any) || col.label}</h3>
                <Badge variant="secondary" className="text-xs">{colOrders.length}</Badge>
              </div>
              <div className="space-y-2">
                {colOrders.map((order: any) => (
                  <Card
                    key={order.id}
                    draggable
                    onDragStart={() => setDragItem(order.id)}
                    onDragEnd={() => setDragItem(null)}
                    className={`cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${dragItem === order.id ? "opacity-50 scale-95" : ""}`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">{order.order_number || order.id.substring(0, 8)}</span>
                        <Badge variant={priorityColor(order.priority || 3)} className="text-[10px]">P{order.priority || 3}</Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{order.products?.name || "—"}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{locale === "sr" ? "Količina" : "Qty"}: {order.quantity}</span>
                        <span>{order.completed_quantity || 0}/{order.quantity}</span>
                      </div>
                      {order.planned_start && (
                        <p className="text-[10px] text-muted-foreground">{order.planned_start} → {order.planned_end || "?"}</p>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full h-6 text-xs"
                        onClick={() => navigate(`/production/orders/${order.id}`)}
                      >
                        {t("details")} <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
