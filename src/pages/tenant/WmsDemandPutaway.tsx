import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Brain, CheckCircle, Package, MapPin, Zap } from "lucide-react";

export default function WmsDemandPutaway() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [warehouseId, setWarehouseId] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Get pending putaway tasks
  const { data: putawayTasks = [] } = useQuery({
    queryKey: ["wms-putaway-tasks", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks")
        .select("*, products(name, sku), wms_bins(id, code, sort_order)")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId)
        .eq("task_type", "putaway")
        .in("status", ["pending", "assigned"])
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  // Get velocity data for AI suggestions
  const { data: velocityData = [] } = useQuery({
    queryKey: ["wms-velocity-putaway", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("wms_product_velocity")
        .select("product_id, pick_count, velocity_class")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!warehouseId,
  });

  // Get available bins with capacity
  const { data: availableBins = [] } = useQuery({
    queryKey: ["wms-available-bins", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bins")
        .select("id, code, sort_order, max_units, zone_id")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  const velocityMap = new Map<string, any>(velocityData.map((v: any) => [v.product_id, v]));

  // AI suggestion: high-velocity → low sort_order (near pick face), low-velocity → high sort_order
  const getSuggestedBin = (productId: string) => {
    const vel = velocityMap.get(productId);
    const isHighVelocity = vel?.velocity_class === "A" || (vel?.pick_count && vel.pick_count > 50);
    const sorted = [...availableBins].sort((a: any, b: any) =>
      isHighVelocity ? a.sort_order - b.sort_order : b.sort_order - a.sort_order
    );
    return sorted[0] || null;
  };

  const acceptSuggestionMutation = useMutation({
    mutationFn: async ({ taskId, binId }: { taskId: string; binId: string }) => {
      const { error } = await supabase.from("wms_tasks")
        .update({ bin_id: binId, status: "assigned" })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-putaway-tasks"] });
      toast({ title: t("success") });
    },
  });

  const pendingCount = putawayTasks.filter((t: any) => t.status === "pending").length;
  const assignedCount = putawayTasks.filter((t: any) => t.status === "assigned").length;

  const stats = [
    { label: locale === "sr" ? "Čeka dodjelu" : "Pending Putaway", value: pendingCount, icon: Package, color: "text-accent" },
    { label: locale === "sr" ? "Dodijeljeno" : "Assigned", value: assignedCount, icon: CheckCircle, color: "text-primary" },
    { label: locale === "sr" ? "Slobodne lokacije" : "Available Bins", value: availableBins.length, icon: MapPin, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsDemandPutaway")} description={t("wmsDemandPutawayDesc")} icon={Download}
        actions={
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
            <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        } />

      <StatsBar stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" />{locale === "sr" ? "AI preporuke za smještaj" : "AI Putaway Suggestions"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{locale === "sr" ? "Brzina" : "Velocity"}</TableHead>
                <TableHead>{locale === "sr" ? "Trenutni bin" : "Current Bin"}</TableHead>
                <TableHead>{locale === "sr" ? "Predloženi bin" : "Suggested Bin"}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {putawayTasks.map((task: any) => {
                const vel = velocityMap.get(task.product_id);
                const suggested = getSuggestedBin(task.product_id);
                return (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div>{task.products?.name}</div>
                      <div className="text-xs text-muted-foreground">{task.products?.sku}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={vel?.velocity_class === "A" ? "default" : vel?.velocity_class === "B" ? "secondary" : "outline"}>
                        {vel?.velocity_class || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{task.wms_bins?.code || "—"}</TableCell>
                    <TableCell>
                      {suggested && (
                        <Badge variant="outline" className="font-mono">
                          <Zap className="h-3 w-3 mr-1 text-primary" />{suggested.code}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {suggested && task.status === "pending" && (
                        <Button size="sm" variant="outline"
                          onClick={() => acceptSuggestionMutation.mutate({ taskId: task.id, binId: suggested.id })}>
                          <CheckCircle className="h-3 w-3 mr-1" />{locale === "sr" ? "Prihvati" : "Accept"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {putawayTasks.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
