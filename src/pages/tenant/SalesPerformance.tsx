import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, ShoppingCart, Target } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function SalesPerformance() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const { data: salespeople = [] } = useQuery({
    queryKey: ["salespeople", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("salespeople").select("*").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_shops", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("*").eq("tenant_id", tenantId!).in("type", ["shop", "branch"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["pos_transactions_perf", tenantId, locationFilter],
    queryFn: async () => {
      let q = supabase.from("pos_transactions").select("*").eq("tenant_id", tenantId!);
      if (locationFilter !== "all") q = q.eq("location_id", locationFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Aggregate per salesperson
  const spPerf = salespeople.map((sp: any) => {
    const spTx = transactions.filter((tx: any) => tx.salesperson_id === sp.id && tx.receipt_type === "sale");
    const revenue = spTx.reduce((s: number, tx: any) => s + Number(tx.total || 0), 0);
    const orders = spTx.length;
    const avgOrder = orders > 0 ? revenue / orders : 0;
    const commission = revenue * Number(sp.commission_rate) / 100;
    return { ...sp, revenue, orders, avgOrder, commission };
  }).sort((a: any, b: any) => b.revenue - a.revenue);

  const totalRevenue = spPerf.reduce((s, sp) => s + sp.revenue, 0);
  const totalOrders = spPerf.reduce((s, sp) => s + sp.orders, 0);
  const avgDeal = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const barData = spPerf.slice(0, 10).map(sp => ({ name: `${sp.first_name} ${sp.last_name?.charAt(0) || ""}.`, revenue: sp.revenue }));

  // Per-store breakdown
  const storeData = locations.map((loc: any) => {
    const locTx = transactions.filter((tx: any) => tx.location_id === loc.id && tx.receipt_type === "sale");
    const rev = locTx.reduce((s: number, tx: any) => s + Number(tx.total || 0), 0);
    return { name: loc.name, value: rev };
  }).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("salesPerformance")}</h1>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allLocations")}</SelectItem>
            {locations.map((loc: any) => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p><p className="text-sm text-muted-foreground">{t("totalRevenue")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ShoppingCart className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{totalOrders}</p><p className="text-sm text-muted-foreground">{t("totalOrders")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{avgDeal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p><p className="text-sm text-muted-foreground">{t("avgDealSize")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Target className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{salespeople.length}</p><p className="text-sm text-muted-foreground">{t("salespeople")}</p></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{t("revenueByPerson")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("revenueByStore")}</CardTitle></CardHeader>
          <CardContent>
            {storeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={storeData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {storeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">{t("noResults")}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("leaderboard")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("salesperson")}</TableHead>
                <TableHead className="text-right">{t("revenue")}</TableHead>
                <TableHead className="text-right">{t("totalOrders")}</TableHead>
                <TableHead className="text-right">{t("avgDealSize")}</TableHead>
                <TableHead className="text-right">{t("commission")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spPerf.map((sp, i) => (
                <TableRow key={sp.id}>
                  <TableCell><Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge></TableCell>
                  <TableCell className="font-medium">{sp.first_name} {sp.last_name}</TableCell>
                  <TableCell className="text-right">{sp.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{sp.orders}</TableCell>
                  <TableCell className="text-right">{sp.avgOrder.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{sp.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
