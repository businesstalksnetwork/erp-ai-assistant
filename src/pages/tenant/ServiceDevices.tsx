import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function ServiceDevices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["service-devices-all", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_devices")
        .select("*, partners(name), warehouses(name), departments(name)")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = devices.filter((d: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.brand?.toLowerCase().includes(s) || d.model?.toLowerCase().includes(s) || d.serial_number?.toLowerCase().includes(s) || d.partners?.name?.toLowerCase().includes(s);
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">{(t as any)("deviceRegistry")}</h1>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">{(t as any)("brand")}</th>
              <th className="px-4 py-3 text-left">{(t as any)("model")}</th>
              <th className="px-4 py-3 text-left">{t("serialNumber" as any)}</th>
              <th className="px-4 py-3 text-left">{t("owner" as any) || "Owner"}</th>
              <th className="px-4 py-3 text-left">{(t as any)("deviceType")}</th>
              <th className="px-4 py-3 text-left">📍 {(t as any)("currentLocation")}</th>
              <th className="px-4 py-3 text-left">{(t as any)("isWarranty")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("noResults")}</td></tr>
            ) : filtered.map((d: any) => {
              const warrantyActive = d.warranty_expiry && new Date(d.warranty_expiry) >= new Date();
              return (
                <tr key={d.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/service/devices/${d.id}`)}>
                  <td className="px-4 py-3">{d.brand || "—"}</td>
                  <td className="px-4 py-3">{d.model || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.serial_number || "—"}</td>
                  <td className="px-4 py-3">{d.is_internal ? (d.departments?.name || (t as any)("internalEquipment")) : (d.partners?.name || "—")}</td>
                  <td className="px-4 py-3 capitalize">{d.device_type}</td>
                  <td className="px-4 py-3">{d.warehouses?.name || "—"}</td>
                  <td className="px-4 py-3">
                    {warrantyActive ? <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">✅</Badge>
                      : d.warranty_expiry ? <Badge variant="outline" className="bg-red-500/10 text-red-600 text-xs">❌</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
