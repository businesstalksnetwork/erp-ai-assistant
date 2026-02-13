import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Play, CheckCircle } from "lucide-react";

export default function WmsPicking() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: waves = [] } = useQuery({
    queryKey: ["wms-pick-waves", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_pick_waves").select("*, warehouses(name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: pickTasks = [] } = useQuery({
    queryKey: ["wms-pick-tasks", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks").select("*, products(name), from_bin:wms_bins!wms_tasks_from_bin_id_fkey(code), to_bin:wms_bins!wms_tasks_to_bin_id_fkey(code)").eq("tenant_id", tenantId!).eq("task_type", "pick").in("status", ["pending", "in_progress"]).order("priority").order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const statusBadge = (status: string) => {
    const v: Record<string, "default" | "secondary" | "outline"> = { draft: "outline", released: "secondary", in_progress: "default", completed: "default" };
    return <Badge variant={v[status] || "outline"}>{status.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsPicking")} description={t("wmsPickingDesc")} icon={ShoppingCart} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{t("pickWaves")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("warehouse")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("date")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {waves.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                ) : waves.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.wave_number}</TableCell>
                    <TableCell>{w.warehouses?.name}</TableCell>
                    <TableCell>{statusBadge(w.status)}</TableCell>
                    <TableCell className="text-xs">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("activePickTasks")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("product")}</TableHead><TableHead>{t("quantity")}</TableHead><TableHead>From Bin</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {pickTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                ) : pickTasks.map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs">{task.task_number}</TableCell>
                    <TableCell>{task.products?.name || "—"}</TableCell>
                    <TableCell>{task.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">{task.from_bin?.code || "—"}</TableCell>
                    <TableCell><Badge variant={task.status === "in_progress" ? "default" : "outline"}>{task.status.replace("_", " ")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
