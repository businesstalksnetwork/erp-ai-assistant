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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Store, Building, Wrench, User, Phone, Mail, ShieldCheck, ShieldX, Package } from "lucide-react";

const CHANNELS = [
  { value: "retail", icon: Store, labelKey: "channelRetail", desc: "Walk-in customer, POS payment" },
  { value: "wholesale", icon: Building, labelKey: "channelWholesale", desc: "Registered partner, invoice payment" },
  { value: "internal", icon: Wrench, labelKey: "channelInternal", desc: "Internal equipment, no charge" },
];

export default function ServiceOrderForm() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [channel, setChannel] = useState("retail");
  const [partnerId, setPartnerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
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
    enabled: !!tenantId && channel === "wholesale",
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
    queryKey: ["service-devices", tenantId, channel, partnerId],
    queryFn: async () => {
      let q = supabase
        .from("service_devices")
        .select("id, brand, model, serial_number, warranty_expiry, product_id, products(name)")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true);
      if (channel === "wholesale" && partnerId) q = q.eq("partner_id", partnerId);
      if (channel === "internal") q = q.eq("is_internal", true);
      if (channel === "retail") q = q.eq("is_internal", false);
      const { data } = await q.limit(200);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const selectedDevice = devices.find((d: any) => d.id === deviceId);
  const warrantyActive = selectedDevice?.warranty_expiry && new Date(selectedDevice.warranty_expiry) >= new Date();
  const warrantyDaysLeft = selectedDevice?.warranty_expiry
    ? Math.max(0, Math.ceil((new Date(selectedDevice.warranty_expiry).getTime() - Date.now()) / 86400000))
    : null;

  const serviceCenters = warehouses.filter((w: any) => w.warehouse_type === "service_center");
  const locationOptions = serviceCenters.length > 0 ? serviceCenters : warehouses;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_service_intake", {
        p_tenant_id: tenantId!,
        p_intake_channel: channel,
        p_service_location_id: serviceLocationId,
        p_origin_location_id: originLocationId || null,
        p_partner_id: channel === "wholesale" ? partnerId || null : null,
        p_device_id: deviceId || null,
        p_reported_issue: reportedIssue,
        p_priority: priority,
        p_user_id: user?.id,
      });
      if (error) throw error;
      if (data) {
        const updates: Record<string, any> = {};
        if (channel === "retail") {
          if (customerName) updates.customer_name = customerName;
          if (customerPhone) updates.customer_phone = customerPhone;
          if (customerEmail) updates.customer_email = customerEmail;
        }
        if (estimatedCompletion) updates.estimated_completion = estimatedCompletion;
        if (Object.keys(updates).length > 0) {
          await supabase.from("service_orders").update(updates).eq("id", data);
        }
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

  const canSubmit = serviceLocationId && reportedIssue && !createMutation.isPending;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{(t as any)("newServiceOrder")}</h1>

      {/* Channel selector */}
      <Card>
        <CardHeader><CardTitle className="text-base">{(t as any)("intakeChannel")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {CHANNELS.map((ch) => (
              <button key={ch.value} onClick={() => { setChannel(ch.value); setPartnerId(""); setDeviceId(""); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${channel === ch.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <ch.icon className={`h-6 w-6 ${channel === ch.value ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">{(t as any)(ch.labelKey)}</span>
                <span className="text-xs text-muted-foreground text-center">{ch.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Retail: walk-in customer */}
      {channel === "retail" && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> {t("customer" as any) || "Customer"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Walk-in — no partner registration required</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><User className="h-3 w-3" /> {t("name")}</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ime i prezime" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {t("phone" as any) || "Phone"}</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+381..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {t("email")}</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wholesale: registered partner */}
      {channel === "wholesale" && (
        <div className="space-y-2">
          <Label>{t("partner" as any) || "Partner"}</Label>
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger><SelectValue placeholder="Select partner..." /></SelectTrigger>
            <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {/* Device — linked to products */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> {t("device" as any) || "Device"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={deviceId} onValueChange={setDeviceId}>
            <SelectTrigger><SelectValue placeholder="Select device..." /></SelectTrigger>
            <SelectContent>
              {devices.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.brand} {d.model}{d.products?.name ? ` (${d.products.name})` : ""}{d.serial_number ? ` — S/N: ${d.serial_number}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDevice && (
            <div className="flex items-center gap-2">
              {warrantyActive ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 gap-1">
                  <ShieldCheck className="h-3 w-3" /> {(t as any)("warrantyActive")} — {warrantyDaysLeft} {(t as any)("daysRemaining")}
                </Badge>
              ) : selectedDevice.warranty_expiry ? (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                  <ShieldX className="h-3 w-3" /> {(t as any)("warrantyExpired")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1">{(t as any)("noWarranty")}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Locations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{(t as any)("originLocation")}</Label>
          <Select value={originLocationId} onValueChange={setOriginLocationId}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{(t as any)("serviceCenter")} *</Label>
          <Select value={serviceLocationId} onValueChange={setServiceLocationId}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{locationOptions.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Issue */}
      <div className="space-y-2">
        <Label>{(t as any)("reportedIssue")} *</Label>
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
        <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
          {createMutation.isPending ? "..." : (t as any)("newServiceOrder")}
        </Button>
      </div>
    </div>
  );
}
