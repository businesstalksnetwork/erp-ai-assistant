import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, Check, Clock, Flame } from "lucide-react";

export default function KitchenDisplay() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingItems = [] } = useQuery({
    queryKey: ["kitchen_items", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_order_items")
        .select("*, restaurant_orders(table_id, restaurant_tables(table_number))")
        .eq("tenant_id", tenantId!)
        .in("status", ["sent", "preparing"])
        .order("sent_to_kitchen_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 5000,
  });

  const markReadyMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("restaurant_order_items")
        .update({ status: "ready", ready_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen_items"] });
      toast({ title: "Označeno kao spremno" });
    },
  });

  const markPreparingMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("restaurant_order_items")
        .update({ status: "preparing" })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kitchen_items"] }),
  });

  // Group by course
  const byCourse = pendingItems.reduce((acc: Record<number, any[]>, item: any) => {
    const course = item.course_number || 1;
    if (!acc[course]) acc[course] = [];
    acc[course].push(item);
    return acc;
  }, {});

  const getTimeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "Upravo";
    return `${mins} min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Kuhinja</h1>
            <p className="text-muted-foreground">{pendingItems.length} stavki čeka</p>
          </div>
        </div>
      </div>

      {pendingItems.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nema narudžbina za pripremu</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(byCourse).sort(([a], [b]) => Number(a) - Number(b)).map(([course, items]) => (
        <div key={course}>
          <h2 className="text-lg font-semibold mb-3">Gang {course}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(items as any[]).map((item: any) => {
              const tableNum = item.restaurant_orders?.restaurant_tables?.table_number;
              const isPreparing = item.status === "preparing";
              return (
                <Card key={item.id} className={`${isPreparing ? "ring-2 ring-warning/50 bg-warning/5" : ""}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-lg">Sto {tableNum || "?"}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.sent_to_kitchen_at ? getTimeSince(item.sent_to_kitchen_at) : "—"}
                        </div>
                      </div>
                      <Badge variant={isPreparing ? "default" : "outline"}>
                        {isPreparing ? <><Flame className="h-3 w-3 mr-1" />Priprema</> : "Čeka"}
                      </Badge>
                    </div>

                    <div className="border-t pt-2">
                      <div className="font-medium">{item.quantity}× {item.product_name}</div>
                      {item.notes && <div className="text-xs text-muted-foreground italic mt-1">📝 {item.notes}</div>}
                      {item.seat_number && <div className="text-xs text-muted-foreground">Sedište {item.seat_number}</div>}
                    </div>

                    <div className="flex gap-2">
                      {!isPreparing && (
                        <Button size="sm" variant="warning" className="flex-1" onClick={() => markPreparingMutation.mutate(item.id)}>
                          <Flame className="h-4 w-4 mr-1" /> Priprema
                        </Button>
                      )}
                      <Button size="sm" variant="success" className="flex-1" onClick={() => markReadyMutation.mutate(item.id)}>
                        <Check className="h-4 w-4 mr-1" /> Spremno
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
