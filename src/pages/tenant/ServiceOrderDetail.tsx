import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Clock, FileText, Package, Wrench } from "lucide-react";

const STATUS_FLOW: Record<string, string[]> = {
  received: ["diagnosed", "cancelled"],
  diagnosed: ["in_repair", "waiting_parts", "cancelled"],
  waiting_parts: ["in_repair", "cancelled"],
  in_repair: ["completed", "waiting_parts"],
  completed: ["delivered"],
  delivered: [],
  cancelled: [],
};

export default function ServiceOrderDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [diagnosisText, setDiagnosisText] = useState("");
  const [resolutionText, setResolutionText] = useState("");
  const [statusNote, setStatusNote] = useState("");

  // Parts form
  const [partProductId, setPartProductId] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partPrice, setPartPrice] = useState("");
  const [partWarranty, setPartWarranty] = useState(false);

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

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-parts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, default_sale_price")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: Record<string, any> = {};
      if (newStatus === "diagnosed" && diagnosisText) updates.diagnosis = diagnosisText;
      if (newStatus === "completed" && resolutionText) updates.resolution = resolutionText;

      if (Object.keys(updates).length > 0) {
        await supabase.from("service_orders").update(updates).eq("id", id!);
      }

      const { error } = await supabase.rpc("change_service_order_status", {
        p_order_id: id!,
        p_new_status: newStatus,
        p_user_id: user?.id,
        p_note: statusNote || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("changeStatus") + " ✓");
      qc.invalidateQueries({ queryKey: ["service-order", id] });
      qc.invalidateQueries({ queryKey: ["service-status-log", id] });
      setDiagnosisText("");
      setResolutionText("");
      setStatusNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const partMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("consume_service_part", {
        p_service_order_id: id!,
        p_product_id: partProductId,
        p_quantity: Number(partQty),
        p_unit_price: Number(partPrice),
        p_is_warranty: partWarranty,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("addPart") + " ✓");
      qc.invalidateQueries({ queryKey: ["service-lines", id] });
      qc.invalidateQueries({ queryKey: ["service-order", id] });
      setPartProductId("");
      setPartQty("1");
      setPartPrice("");
      setPartWarranty(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("generate_invoice_from_service_order", {
        p_order_id: id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("generateInvoice") + " ✓");
      qc.invalidateQueries({ queryKey: ["service-order", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!order) return <div className="p-6 text-center text-muted-foreground">Not found</div>;

  const statusLabel = (s: string) => (t as any)(`status${s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}`) || s;
  const device = order.service_devices as any;
  const warrantyActive = device?.warranty_expiry && new Date(device.warranty_expiry) >= new Date();
  const nextStatuses = STATUS_FLOW[order.status] || [];
  const canGenerateInvoice = order.status === "completed" && !(order as any).linked_invoice_id && order.intake_channel !== "internal";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/service/orders")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-bold">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.intake_channel === "retail" ? "🏪" : order.intake_channel === "wholesale" ? "🏢" : "🔧"}{" "}
            {(order as any).partners?.name || t("channelInternal")}
          </p>
        </div>
        <Badge className="ml-auto">{statusLabel(order.status)}</Badge>
      </div>

      {/* Status transition buttons */}
      {nextStatuses.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {order.status === "received" && (
              <div className="space-y-1.5">
                <Label>{t("diagnosis")}</Label>
                <Textarea value={diagnosisText} onChange={e => setDiagnosisText(e.target.value)} rows={2} placeholder={t("diagnosis") + "..."} />
              </div>
            )}
            {(order.status === "in_repair" || order.status === "diagnosed") && (
              <div className="space-y-1.5">
                <Label>{t("resolution")}</Label>
                <Textarea value={resolutionText} onChange={e => setResolutionText(e.target.value)} rows={2} placeholder={t("resolution") + "..."} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t("technicianNotes")}</Label>
              <Input value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder={t("technicianNotes") + "..."} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {nextStatuses.map(ns => (
                <Button key={ns} size="sm" variant={ns === "cancelled" ? "destructive" : "default"}
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(ns)}>
                  → {statusLabel(ns)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice generation */}
      {canGenerateInvoice && (
        <Button onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending}>
          <FileText className="h-4 w-4 mr-2" /> {t("generateInvoice")}
        </Button>
      )}
      {(order as any).linked_invoice_id && (
        <Badge variant="outline" className="cursor-pointer" onClick={() => navigate(`/invoices/${(order as any).linked_invoice_id}`)}>
          <FileText className="h-3 w-3 mr-1" /> {t("generateInvoice")} ✓
        </Badge>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("serviceHistory")}</CardTitle></CardHeader>
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
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">✅ {t("warrantyActive")}</Badge>
                  ) : device.warranty_expiry ? (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600">{t("warrantyExpired")}</Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details"><Wrench className="h-3.5 w-3.5 mr-1.5" />{t("details" as any) || "Details"}</TabsTrigger>
              <TabsTrigger value="parts"><Package className="h-3.5 w-3.5 mr-1.5" />{t("partsCost")} ({lines.length})</TabsTrigger>
              <TabsTrigger value="work"><Clock className="h-3.5 w-3.5 mr-1.5" />{t("workOrders")} ({workOrders.length})</TabsTrigger>
            </TabsList>

            {/* Details tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div><p className="text-xs font-medium text-muted-foreground mb-1">{t("reportedIssue")}</p><p className="text-sm">{order.reported_issue}</p></div>
                  {order.diagnosis && <><Separator /><div><p className="text-xs font-medium text-muted-foreground mb-1">{t("diagnosis")}</p><p className="text-sm">{order.diagnosis}</p></div></>}
                  {order.resolution && <><Separator /><div><p className="text-xs font-medium text-muted-foreground mb-1">{t("resolution")}</p><p className="text-sm">{order.resolution}</p></div></>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Parts tab */}
            <TabsContent value="parts" className="space-y-4 mt-4">
              {/* Add part form */}
              {["received", "diagnosed", "in_repair", "waiting_parts"].includes(order.status) && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">{t("addPart")}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Select value={partProductId} onValueChange={v => {
                        setPartProductId(v);
                        const p = products.find((pr: any) => pr.id === v);
                        if (p?.default_sale_price) setPartPrice(String(p.default_sale_price));
                      }}>
                        <SelectTrigger><SelectValue placeholder={t("products" as any) || "Product"} /></SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min="1" value={partQty} onChange={e => setPartQty(e.target.value)} placeholder={t("quantity" as any) || "Qty"} />
                      <Input type="number" min="0" step="0.01" value={partPrice} onChange={e => setPartPrice(e.target.value)} placeholder={t("price" as any) || "Price"} />
                      <div className="flex items-center gap-2">
                        <Switch checked={partWarranty} onCheckedChange={setPartWarranty} />
                        <Label className="text-xs">{t("warrantyCovered")}</Label>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => partMutation.mutate()} disabled={!partProductId || !partPrice || partMutation.isPending}>
                      {t("addPart")}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Parts list */}
              {lines.length > 0 && (
                <Card>
                  <CardContent className="p-4">
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
                            <td className="py-2 text-right tabular-nums">{l.quantity}</td>
                            <td className="py-2 text-right tabular-nums">{Number(l.unit_price).toLocaleString("sr-RS")}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{Number(l.line_total).toLocaleString("sr-RS")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-sm font-medium">
                      <span>{t("totalServiceCost")}</span>
                      <span className="font-mono tabular-nums">{Number(order.total_amount).toLocaleString("sr-RS")} RSD</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Work orders tab */}
            <TabsContent value="work" className="space-y-4 mt-4">
              {workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t("noResults")}</p>
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
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
