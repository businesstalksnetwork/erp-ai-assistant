import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Package, Target, TrendingUp, Warehouse, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))"];

export default function WmsAnalytics() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
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

  // Bin utilization
  const { data: bins = [] } = useQuery({
    queryKey: ["wms-analytics-bins", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bins")
        .select("id, code, is_active, zone_id")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  const { data: binStock = [] } = useQuery({
    queryKey: ["wms-analytics-stock", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bin_stock")
        .select("bin_id, quantity")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  // Velocity distribution
  const { data: velocity = [] } = useQuery({
    queryKey: ["wms-analytics-velocity", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("wms_product_velocity")
        .select("velocity_class, pick_count")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!warehouseId,
  });

  // Cycle count accuracy
  const { data: counts = [] } = useQuery({
    queryKey: ["wms-analytics-counts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_cycle_counts")
        .select("id, count_number, accuracy_rate, created_at, status")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Compute stats
  const occupiedBins = new Set(binStock.map((s: any) => s.bin_id));
  const utilizationPct = bins.length > 0 ? Math.round((occupiedBins.size / bins.length) * 100) : 0;
  const totalPicks = velocity.reduce((s: number, v: any) => s + (v.pick_count || 0), 0);
  const avgAccuracy = counts.filter((c: any) => c.accuracy_rate != null).length > 0
    ? Math.round(counts.filter((c: any) => c.accuracy_rate != null).reduce((s: number, c: any) => s + c.accuracy_rate, 0) / counts.filter((c: any) => c.accuracy_rate != null).length)
    : 0;

  const stats = [
    { label: locale === "sr" ? "Iskorišćenost" : "Space Utilization", value: `${utilizationPct}%`, icon: Warehouse, color: "text-primary" },
    { label: locale === "sr" ? "Ukupno pickova" : "Total Picks", value: totalPicks, icon: Package, color: "text-accent" },
    { label: locale === "sr" ? "Tačnost popisa" : "Count Accuracy", value: `${avgAccuracy}%`, icon: Target, color: avgAccuracy >= 95 ? "text-primary" : "text-destructive" },
    { label: locale === "sr" ? "Proizvoda" : "Products Tracked", value: velocity.length, icon: TrendingUp, color: "text-primary" },
  ];

  // ABC distribution chart
  const abcData = ["A", "B", "C"].map(cls => ({
    name: cls,
    value: velocity.filter((v: any) => v.velocity_class === cls).length,
  }));

  // Accuracy over time
  const accuracyTrend = counts.filter((c: any) => c.accuracy_rate != null).map((c: any) => ({
    name: c.count_number?.slice(-6) || "—",
    accuracy: Math.round(c.accuracy_rate || 0),
  }));

  // Zone utilization
  const zoneUtil: Record<string, { total: number; occupied: number }> = {};
  bins.forEach((b: any) => {
    const z = b.zone_id || "default";
    if (!zoneUtil[z]) zoneUtil[z] = { total: 0, occupied: 0 };
    zoneUtil[z].total++;
    if (occupiedBins.has(b.id)) zoneUtil[z].occupied++;
  });
  const zoneData = Object.entries(zoneUtil).map(([zone, d]) => ({
    name: zone.slice(0, 8),
    utilization: d.total > 0 ? Math.round((d.occupied / d.total) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsAnalytics")} description={t("wmsAnalyticsDesc")} icon={BarChart3}
        actions={
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
            <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        } />

      <StatsBar stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{locale === "sr" ? "ABC distribucija" : "ABC Distribution"}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={abcData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {abcData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{locale === "sr" ? "Iskorišćenost po zoni" : "Zone Utilization"}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={zoneData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis unit="%" />
                <Tooltip />
                <Bar dataKey="utilization" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" />{locale === "sr" ? "Trend tačnosti popisa" : "Count Accuracy Trend"}</CardTitle></CardHeader>
          <CardContent>
            {accuracyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={accuracyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis unit="%" domain={[80, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
