import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock } from "lucide-react";

export default function ServiceOrderDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ["service-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*, service_devices(brand, model, serial_number, warranty_expiry), partners(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["service-work-orders", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_work_orders")
        .select("*, employees(first_name, last_name)")
        .eq("service_order_id", id!)
        .order("sort_order");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: statusLog = [] } = useQuery({
    queryKey: ["service-status-log", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_order_status_log")
        .select("*")
        .eq("service_order_id", id!)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["service-lines", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_order_lines")
        .select("*, products(name)")
        .eq("service_order_id", id!)
        .order("sort_order");
      return data || [];
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!order) return <div className="p-6 text-center text-muted-foreground">Not found</div>;

  const statusLabel = (s: string) => (t as any)(`status${s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}`) || s;
  const device = order.service_devices as any;
  const warrantyActive = device?.warranty_expiry && new Date(device.warranty_expiry) >= new Date();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/service/orders")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-bold">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.intake_channel === "retail" ? "🏪" : order.intake_channel === "wholesale" ? "🏢" : "🔧"}{" "}
            {(order as any).partners?.name || (t as any)("channelInternal")}
          </p>
        </div>
        <Badge className="ml-auto">{statusLabel(order.status)}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("timeline" as any) || "Timeline"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {statusLog.map((log: any, i: number) => (
              <div key={log.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${i === statusLog.length - 1 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  {i < statusLog.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-medium">{statusLabel(log.new_status)}</p>
                  {log.note && <p className="text-xs text-muted-foreground">{log.note}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("sr-RS")}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Device info */}
          {device && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{device.brand} {device.model}</p>
                    {device.serial_number && <p className="text-sm text-muted-foreground">S/N: {device.serial_number}</p>}
                  </div>
                  {warrantyActive ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">✅ {(t as any)("warrantyActive")}</Badge>
                  ) : device.warranty_expiry ? (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600">{(t as any)("warrantyExpired")}</Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Issue / Diagnosis */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div><p className="text-xs font-medium text-muted-foreground mb-1">{(t as any)("reportedIssue")}</p><p className="text-sm">{order.reported_issue}</p></div>
              {order.diagnosis && <><Separator /><div><p className="text-xs font-medium text-muted-foreground mb-1">{(t as any)("diagnosis")}</p><p className="text-sm">{order.diagnosis}</p></div></>}
              {order.resolution && <><Separator /><div><p className="text-xs font-medium text-muted-foreground mb-1">{(t as any)("resolution")}</p><p className="text-sm">{order.resolution}</p></div></>}
            </CardContent>
          </Card>

          {/* Work Orders */}
          <Card>
            <CardHeader><CardTitle className="text-sm">{(t as any)("workOrders")} ({workOrders.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noResults")}</p>
              ) : workOrders.map((wo: any) => (
                <div key={wo.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{wo.work_order_number} — {wo.title}</p>
                      {wo.employees && <p className="text-xs text-muted-foreground">{wo.employees.first_name} {wo.employees.last_name}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{wo.status}</Badge>
                      {wo.estimated_hours && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{wo.estimated_hours}h</span>}
                    </div>
                  </div>
                  {wo.description && <p className="text-xs text-muted-foreground">{wo.description}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Lines */}
          {lines.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">{t("items" as any) || "Items"} ({lines.length})</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="text-muted-foreground text-xs">
                    <th className="text-left py-1">{t("description")}</th>
                    <th className="text-right py-1">{t("quantity" as any)}</th>
                    <th className="text-right py-1">{t("price" as any)}</th>
                    <th className="text-right py-1">{t("total" as any)}</th>
                  </tr></thead>
                  <tbody>
                    {lines.map((l: any) => (
                      <tr key={l.id} className="border-t">
                        <td className="py-2">{l.description || l.products?.name || "—"}{l.is_warranty_covered && " ✅"}</td>
                        <td className="py-2 text-right">{l.quantity}</td>
                        <td className="py-2 text-right">{Number(l.unit_price).toLocaleString("sr-RS")}</td>
                        <td className="py-2 text-right font-mono">{Number(l.line_total).toLocaleString("sr-RS")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Separator className="my-2" />
                <div className="flex justify-between text-sm font-medium">
                  <span>{(t as any)("totalServiceCost")}</span>
                  <span className="font-mono">{Number(order.total_amount).toLocaleString("sr-RS")} RSD</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
