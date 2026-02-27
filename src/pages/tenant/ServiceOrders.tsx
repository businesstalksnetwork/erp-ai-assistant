import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ClipboardCheck, AlertTriangle, Clock, CheckCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-500/10 text-blue-600 border-blue-200",
  diagnosed: "bg-purple-500/10 text-purple-600 border-purple-200",
  waiting_parts: "bg-amber-500/10 text-amber-600 border-amber-200",
  in_repair: "bg-orange-500/10 text-orange-600 border-orange-200",
  completed: "bg-green-500/10 text-green-600 border-green-200",
  delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  cancelled: "bg-red-500/10 text-red-600 border-red-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function ServiceOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["service-orders", tenantId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("service_orders")
        .select("*, service_devices(brand, model, serial_number), partners(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: stats } = useQuery({
    queryKey: ["service-stats", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("status, priority")
        .eq("tenant_id", tenantId!)
        .not("status", "in", '("delivered","cancelled")');
      const open = data?.length || 0;
      const urgent = data?.filter((o: any) => o.priority === "urgent").length || 0;
      const waitingParts = data?.filter((o: any) => o.status === "waiting_parts").length || 0;
      return { open, urgent, waitingParts };
    },
    enabled: !!tenantId,
  });

  const filtered = orders.filter((o: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(s) ||
      o.reported_issue?.toLowerCase().includes(s) ||
      o.service_devices?.brand?.toLowerCase().includes(s) ||
      o.service_devices?.model?.toLowerCase().includes(s) ||
      o.partners?.name?.toLowerCase().includes(s)
    );
  });

  const statusLabel = (s: string) => (t as any)(`status${s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}`) || s;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{(t as any)("serviceOrders")}</h1>
        <Button onClick={() => navigate("/service/orders/new")}>
          <Plus className="h-4 w-4 mr-2" /> {(t as any)("newServiceOrder")}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-primary opacity-60" />
          <div><p className="text-sm text-muted-foreground">{(t as any)("openServiceOrders")}</p><p className="text-2xl font-bold">{stats?.open ?? "—"}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive opacity-60" />
          <div><p className="text-sm text-muted-foreground">{(t as any)("urgentServiceOrders")}</p><p className="text-2xl font-bold">{stats?.urgent ?? "—"}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-amber-500 opacity-60" />
          <div><p className="text-sm text-muted-foreground">{(t as any)("statusWaitingParts")}</p><p className="text-2xl font-bold">{stats?.waitingParts ?? "—"}</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all" as any) || "All"}</SelectItem>
            {["received","diagnosed","waiting_parts","in_repair","completed","delivered","cancelled"].map(s => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">{(t as any)("status")}</th>
              <th className="px-4 py-3 text-left font-medium">{(t as any)("intakeChannel")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("customer" as any) || "Customer"}</th>
              <th className="px-4 py-3 text-left font-medium">{t("device" as any) || "Device"}</th>
              <th className="px-4 py-3 text-left font-medium">{t("priority" as any) || "Priority"}</th>
              <th className="px-4 py-3 text-right font-medium">{(t as any)("totalServiceCost")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("noResults")}</td></tr>
            ) : filtered.map((o: any) => (
              <tr key={o.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/service/orders/${o.id}`)}>
                <td className="px-4 py-3 font-mono text-xs">{o.order_number}</td>
                <td className="px-4 py-3"><Badge variant="outline" className={STATUS_COLORS[o.status] || ""}>{statusLabel(o.status)}</Badge></td>
                <td className="px-4 py-3 capitalize">{o.intake_channel === "retail" ? "🏪" : o.intake_channel === "wholesale" ? "🏢" : "🔧"} {(t as any)(`channel${o.intake_channel.charAt(0).toUpperCase() + o.intake_channel.slice(1)}`)}</td>
                <td className="px-4 py-3">{o.partners?.name || "—"}</td>
                <td className="px-4 py-3">{o.service_devices ? `${o.service_devices.brand || ""} ${o.service_devices.model || ""}`.trim() : "—"}</td>
                <td className="px-4 py-3"><Badge variant="outline" className={PRIORITY_COLORS[o.priority] || ""}>{(t as any)(`priority${o.priority.charAt(0).toUpperCase() + o.priority.slice(1)}`)}</Badge></td>
                <td className="px-4 py-3 text-right font-mono">{Number(o.total_amount || 0).toLocaleString("sr-RS")} RSD</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
