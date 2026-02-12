import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, ShoppingCart, Target, Store, Briefcase, Users } from "lucide-react";

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

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices_perf", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, total, salesperson_id, status").eq("tenant_id", tenantId!).in("status", ["posted", "paid"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["opps_perf", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("id, value, stage, salesperson_id").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const inStoreSP = salespeople.filter((sp: any) => sp.role_type === "in_store");
  const wholesaleSP = salespeople.filter((sp: any) => sp.role_type === "wholesale");

  // === IN-STORE ANALYTICS ===
  const inStorePerf = inStoreSP.map((sp: any) => {
    const spTx = transactions.filter((tx: any) => tx.salesperson_id === sp.id && tx.receipt_type === "sale");
    const revenue = spTx.reduce((s: number, tx: any) => s + Number(tx.total || 0), 0);
    const orders = spTx.length;
    const avgOrder = orders > 0 ? revenue / orders : 0;
    const commission = revenue * Number(sp.commission_rate) / 100;
    return { ...sp, revenue, orders, avgOrder, commission };
  }).sort((a: any, b: any) => b.revenue - a.revenue);

  const inStoreRevenue = inStorePerf.reduce((s, sp) => s + sp.revenue, 0);
  const inStoreOrders = inStorePerf.reduce((s, sp) => s + sp.orders, 0);
  const inStoreAvg = inStoreOrders > 0 ? inStoreRevenue / inStoreOrders : 0;

  const inStoreBarData = inStorePerf.slice(0, 10).map(sp => ({ name: `${sp.first_name} ${sp.last_name?.charAt(0) || ""}.`, revenue: sp.revenue }));

  const storeData = locations.map((loc: any) => {
    const locTx = transactions.filter((tx: any) => tx.location_id === loc.id && tx.receipt_type === "sale");
    const rev = locTx.reduce((s: number, tx: any) => s + Number(tx.total || 0), 0);
    return { name: loc.name, value: rev };
  }).filter(d => d.value > 0);

  // === WHOLESALE ANALYTICS ===
  const wholesalePerf = wholesaleSP.map((sp: any) => {
    const spInv = invoices.filter((inv: any) => inv.salesperson_id === sp.id);
    const invRevenue = spInv.reduce((s: number, inv: any) => s + Number(inv.total || 0), 0);
    const spOpps = opportunities.filter((o: any) => o.salesperson_id === sp.id);
    const pipeline = spOpps.filter((o: any) => o.stage !== "closed_won" && o.stage !== "closed_lost").reduce((s: number, o: any) => s + Number(o.value || 0), 0);
    const won = spOpps.filter((o: any) => o.stage === "closed_won").length;
    const lost = spOpps.filter((o: any) => o.stage === "closed_lost").length;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    const dealCount = spOpps.length;
    return { ...sp, invRevenue, pipeline, won, lost, winRate, dealCount };
  }).sort((a: any, b: any) => b.invRevenue - a.invRevenue);

  const totalWholesaleRev = wholesalePerf.reduce((s, sp) => s + sp.invRevenue, 0);
  const totalPipeline = wholesalePerf.reduce((s, sp) => s + sp.pipeline, 0);
  const totalWon = wholesalePerf.reduce((s, sp) => s + sp.won, 0);
  const totalLost = wholesalePerf.reduce((s, sp) => s + sp.lost, 0);
  const overallWinRate = totalWon + totalLost > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0;
  const avgDeal = totalWon > 0 ? totalWholesaleRev / totalWon : 0;

  const wholesaleBarData = wholesalePerf.slice(0, 10).map(sp => ({ name: `${sp.first_name} ${sp.last_name?.charAt(0) || ""}.`, revenue: sp.invRevenue }));
  const wonDealsData = wholesalePerf.filter(sp => sp.won > 0).map(sp => ({ name: `${sp.first_name} ${sp.last_name?.charAt(0) || ""}.`, value: sp.won }));

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("salesPerformance")}</h1>

      <Tabs defaultValue="in_store">
        <TabsList>
          <TabsTrigger value="in_store" className="gap-2"><Store className="h-4 w-4" />{t("inStorePerformance")}</TabsTrigger>
          <TabsTrigger value="wholesale" className="gap-2"><Briefcase className="h-4 w-4" />{t("wholesalePerformance")}</TabsTrigger>
        </TabsList>

        {/* === IN-STORE TAB === */}
        <TabsContent value="in_store" className="space-y-6">
          <div className="flex justify-end">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allLocations")}</SelectItem>
                {locations.map((loc: any) => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{fmt(inStoreRevenue)}</p><p className="text-sm text-muted-foreground">{t("retailRevenue")}</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ShoppingCart className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{inStoreOrders}</p><p className="text-sm text-muted-foreground">{t("posTransactions")}</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{fmt(inStoreAvg)}</p><p className="text-sm text-muted-foreground">{t("avgDealSize")}</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{inStoreSP.length}</p><p className="text-sm text-muted-foreground">{t("activeSellers")}</p></div></div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>{t("revenueByPerson")}</CardTitle></CardHeader>
              <CardContent>
                {inStoreBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={inStoreBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-12">{t("noResults")}</p>}
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
            <CardHeader><CardTitle>{t("leaderboard")} — {t("inStore")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("salesperson")}</TableHead>
                    <TableHead className="text-right">{t("revenue")}</TableHead>
                    <TableHead className="text-right">{t("posTransactions")}</TableHead>
                    <TableHead className="text-right">{t("avgDealSize")}</TableHead>
                    <TableHead className="text-right">{t("commission")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inStorePerf.map((sp, i) => (
                    <TableRow key={sp.id}>
                      <TableCell><Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge></TableCell>
                      <TableCell className="font-medium">{sp.first_name} {sp.last_name}</TableCell>
                      <TableCell className="text-right">{fmt(sp.revenue)}</TableCell>
                      <TableCell className="text-right">{sp.orders}</TableCell>
                      <TableCell className="text-right">{fmt(sp.avgOrder)}</TableCell>
                      <TableCell className="text-right">{fmt(sp.commission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === WHOLESALE TAB === */}
        <TabsContent value="wholesale" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{fmt(totalWholesaleRev)}</p><p className="text-sm text-muted-foreground">{t("wholesaleRevenue")}</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{fmt(totalPipeline)}</p><p className="text-sm text-muted-foreground">{t("pipelineValueKom")}</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Target className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{fmt(avgDeal)}</p><p className="text-sm text-muted-foreground">{t("avgDealSize")}</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Briefcase className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{overallWinRate}%</p><p className="text-sm text-muted-foreground">{t("winRate")}</p></div></div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>{t("wholesaleRevenue")}</CardTitle></CardHeader>
              <CardContent>
                {wholesaleBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wholesaleBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-12">{t("noResults")}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t("wonDeals")}</CardTitle></CardHeader>
              <CardContent>
                {wonDealsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={wonDealsData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {wonDealsData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-12">{t("noResults")}</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{t("leaderboard")} — {t("wholesale")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("salesperson")}</TableHead>
                    <TableHead className="text-right">{t("wholesaleRevenue")}</TableHead>
                    <TableHead className="text-right">{t("pipelineValueKom")}</TableHead>
                    <TableHead className="text-right">{t("wonDeals")}</TableHead>
                    <TableHead className="text-right">{t("winRate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wholesalePerf.map((sp, i) => (
                    <TableRow key={sp.id}>
                      <TableCell><Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge></TableCell>
                      <TableCell className="font-medium">{sp.first_name} {sp.last_name}</TableCell>
                      <TableCell className="text-right">{fmt(sp.invRevenue)}</TableCell>
                      <TableCell className="text-right">{fmt(sp.pipeline)}</TableCell>
                      <TableCell className="text-right">{sp.won}</TableCell>
                      <TableCell className="text-right">{sp.winRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
