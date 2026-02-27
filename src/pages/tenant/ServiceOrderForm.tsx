import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Store, Building, Wrench } from "lucide-react";

const CHANNELS = [
  { value: "retail", icon: Store, labelKey: "channelRetail" },
  { value: "wholesale", icon: Building, labelKey: "channelWholesale" },
  { value: "internal", icon: Wrench, labelKey: "channelInternal" },
];

export default function ServiceOrderForm() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [channel, setChannel] = useState("retail");
  const [partnerId, setPartnerId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [serviceLocationId, setServiceLocationId] = useState("");
  const [originLocationId, setOriginLocationId] = useState("");
  const [reportedIssue, setReportedIssue] = useState("");
  const [priority, setPriority] = useState("normal");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).order("name").limit(500);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name, warehouse_type").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["service-devices", tenantId, partnerId],
    queryFn: async () => {
      let q = supabase.from("service_devices").select("id, brand, model, serial_number, warranty_expiry").eq("tenant_id", tenantId!).eq("is_active", true);
      if (channel !== "internal" && partnerId) q = q.eq("partner_id", partnerId);
      if (channel === "internal") q = q.eq("is_internal", true);
      const { data } = await q.limit(200);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const serviceCenters = warehouses.filter((w: any) => w.warehouse_type === "service_center");
  const originWarehouses = warehouses;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_service_intake", {
        p_tenant_id: tenantId!,
        p_intake_channel: channel,
        p_service_location_id: serviceLocationId,
        p_origin_location_id: originLocationId || null,
        p_partner_id: channel !== "internal" ? partnerId || null : null,
        p_device_id: deviceId || null,
        p_reported_issue: reportedIssue,
        p_priority: priority,
        p_user_id: user?.id,
      });
      if (error) throw error;
      // Update estimated completion if set
      if (estimatedCompletion && data) {
        await supabase.from("service_orders").update({ estimated_completion: estimatedCompletion }).eq("id", data);
      }
      return data;
    },
    onSuccess: (id) => {
      toast.success((t as any)("serviceOrders") + " created");
      qc.invalidateQueries({ queryKey: ["service-orders"] });
      navigate(`/service/orders/${id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{(t as any)("newServiceOrder")}</h1>

      {/* Channel selector */}
      <Card>
        <CardHeader><CardTitle className="text-base">{(t as any)("intakeChannel")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {CHANNELS.map((ch) => (
              <button key={ch.value} onClick={() => setChannel(ch.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${channel === ch.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <ch.icon className={`h-6 w-6 ${channel === ch.value ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">{(t as any)(ch.labelKey)}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Partner / Customer */}
      {channel !== "internal" && (
        <div className="space-y-2">
          <Label>{channel === "retail" ? t("customer" as any) || "Customer" : t("partner" as any) || "Partner"}</Label>
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {/* Locations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{(t as any)("originLocation")}</Label>
          <Select value={originLocationId} onValueChange={setOriginLocationId}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{originWarehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{(t as any)("serviceCenter")}</Label>
          <Select value={serviceLocationId} onValueChange={setServiceLocationId}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {serviceCenters.length > 0 ? serviceCenters.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)
                : warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Device */}
      <div className="space-y-2">
        <Label>{t("device" as any) || "Device"}</Label>
        <Select value={deviceId} onValueChange={setDeviceId}>
          <SelectTrigger><SelectValue placeholder="Select device..." /></SelectTrigger>
          <SelectContent>
            {devices.map((d: any) => (
              <SelectItem key={d.id} value={d.id}>
                {d.brand} {d.model} {d.serial_number ? `(S/N: ${d.serial_number})` : ""}
                {d.warranty_expiry && new Date(d.warranty_expiry) >= new Date() ? " ✅" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Issue */}
      <div className="space-y-2">
        <Label>{(t as any)("reportedIssue")}</Label>
        <Textarea value={reportedIssue} onChange={(e) => setReportedIssue(e.target.value)} rows={3} placeholder="Describe the issue..." />
      </div>

      {/* Priority & Date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("priority" as any) || "Priority"}</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["low","normal","high","urgent"].map(p => <SelectItem key={p} value={p}>{(t as any)(`priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{(t as any)("estimatedCompletion")}</Label>
          <Input type="date" value={estimatedCompletion} onChange={(e) => setEstimatedCompletion(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={() => navigate("/service/orders")}>{t("cancel")}</Button>
        <Button onClick={() => createMutation.mutate()} disabled={!serviceLocationId || !reportedIssue || createMutation.isPending}>
          {createMutation.isPending ? "..." : (t as any)("newServiceOrder")}
        </Button>
      </div>
    </div>
  );
}
