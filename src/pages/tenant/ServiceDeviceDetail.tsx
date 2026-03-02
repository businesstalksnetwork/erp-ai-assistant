import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, ShieldX, Clock, Wrench } from "lucide-react";

export default function ServiceDeviceDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  const { data: device, isLoading } = useQuery({
    queryKey: ["service-device", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_devices")
        .select("*, partners(name), warehouses(name), departments(name), products(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: warranty } = useQuery({
    queryKey: ["device-warranty", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("check_device_warranty", { p_device_id: id! });
      return data;
    },
    enabled: !!id,
  });

  const { data: serviceHistory = [] } = useQuery({
    queryKey: ["device-service-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("id, order_number, status, reported_issue, total_amount, created_at")
        .eq("device_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!device) return <div className="p-6 text-center text-muted-foreground">Not found</div>;

  const d = device as any;
  const warrantyActive = d.warranty_expiry && new Date(d.warranty_expiry) >= new Date();
  const daysLeft = d.warranty_expiry ? Math.max(0, Math.ceil((new Date(d.warranty_expiry).getTime() - Date.now()) / 86400000)) : null;
  const totalRepairCost = serviceHistory.reduce((sum: number, so: any) => sum + Number(so.total_amount || 0), 0);

  const statusLabel = (s: string) => t(`status${s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}`) || s;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/service/devices")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-bold">{d.brand} {d.model}</h1>
          {d.serial_number && <p className="text-sm text-muted-foreground">S/N: {d.serial_number}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">{t("owner") || "Owner"}</p>
            <p className="font-medium">{d.is_internal ? (d.departments?.name || t("internalEquipment")) : (d.partners?.name || "—")}</p>
            {d.products?.name && <p className="text-sm text-muted-foreground">{d.products.name}</p>}
            {d.warehouses?.name && <p className="text-sm">📍 {d.warehouses.name}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">{t("isWarranty")}</p>
            {warrantyActive ? (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-600">{t("warrantyActive")}</p>
                  <p className="text-xs text-muted-foreground">{daysLeft} {t("daysRemaining")}</p>
                </div>
              </div>
            ) : d.warranty_expiry ? (
              <div className="flex items-center gap-2">
                <ShieldX className="h-5 w-5 text-destructive" />
                <p className="font-medium text-destructive">{t("warrantyExpired")}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">{t("noWarranty")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">{t("serviceHistory")}</p>
            <p className="text-2xl font-bold tabular-nums">{serviceHistory.length}</p>
            <p className="text-xs text-muted-foreground">{t("totalServiceCost")}: <span className="font-mono tabular-nums">{totalRepairCost.toLocaleString("sr-RS")} RSD</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Service history timeline */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4" /> {t("serviceHistory")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {serviceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("noResults")}</p>
          ) : serviceHistory.map((so: any) => (
            <div key={so.id} className="flex items-center justify-between border rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => navigate(`/service/orders/${so.id}`)}>
              <div>
                <p className="font-medium text-sm">{so.order_number}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{so.reported_issue}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{new Date(so.created_at).toLocaleDateString("sr-RS")}</p>
              </div>
              <div className="flex items-center gap-3">
                {Number(so.total_amount) > 0 && <span className="text-sm font-mono tabular-nums">{Number(so.total_amount).toLocaleString("sr-RS")} RSD</span>}
                <Badge variant="outline" className="text-xs">{statusLabel(so.status)}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
