import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, TrendingUp, Star, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const TIER_COLORS: Record<string, string> = {
  Bronze: "hsl(30, 60%, 50%)",
  Silver: "hsl(0, 0%, 65%)",
  Gold: "hsl(45, 90%, 50%)",
  Platinum: "hsl(220, 60%, 55%)",
};

export default function LoyaltyAnalytics() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: members = [] } = useQuery({
    queryKey: ["loyalty_members_analytics", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase.from("loyalty_members") as any)
        .select("*, loyalty_programs(name, points_per_currency)")
        .eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["loyalty_transactions_analytics", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("loyalty_transactions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Tier distribution
  const tierCounts = members.reduce((acc: Record<string, number>, m: any) => {
    const tier = m.current_tier || "Bronze";
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});
  const tierData = Object.entries(tierCounts).map(([name, value]) => ({ name, value }));

  // RFM Segmentation (simplified)
  const now = new Date();
  const rfmSegments = members.map((m: any) => {
    const daysSinceEnroll = Math.floor((now.getTime() - new Date(m.enrolled_at || m.created_at).getTime()) / 86400000);
    const lifetime = m.lifetime_points || 0;
    const balance = m.points_balance || 0;

    // Simplified RFM scoring (1-5 scale)
    const recency = daysSinceEnroll < 30 ? 5 : daysSinceEnroll < 90 ? 4 : daysSinceEnroll < 180 ? 3 : daysSinceEnroll < 365 ? 2 : 1;
    const frequency = lifetime > 5000 ? 5 : lifetime > 2000 ? 4 : lifetime > 500 ? 3 : lifetime > 100 ? 2 : 1;
    const monetary = balance > 2000 ? 5 : balance > 1000 ? 4 : balance > 300 ? 3 : balance > 50 ? 2 : 1;

    const rfmScore = recency + frequency + monetary;
    const segment = rfmScore >= 13 ? "Champions" : rfmScore >= 10 ? "Loyal" : rfmScore >= 7 ? "Potential" : rfmScore >= 4 ? "At Risk" : "Lost";

    return { ...m, recency, frequency, monetary, rfmScore, segment };
  });

  const segmentCounts = rfmSegments.reduce((acc: Record<string, number>, m: any) => {
    acc[m.segment] = (acc[m.segment] || 0) + 1;
    return acc;
  }, {});
  const segmentData = Object.entries(segmentCounts).map(([name, value]) => ({ name, value }));

  // CLV estimate (simplified: lifetime_points * rough value factor)
  const avgCLV = members.length > 0
    ? members.reduce((s: number, m: any) => s + (m.lifetime_points || 0), 0) / members.length
    : 0;
  const topCLVMembers = [...rfmSegments].sort((a, b) => (b.lifetime_points || 0) - (a.lifetime_points || 0)).slice(0, 10);

  const totalPoints = members.reduce((s: number, m: any) => s + (m.points_balance || 0), 0);

  const SEGMENT_COLORS = ["hsl(142, 70%, 45%)", "hsl(210, 70%, 50%)", "hsl(45, 80%, 50%)", "hsl(25, 80%, 50%)", "hsl(0, 70%, 50%)"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analitika lojalnosti</h1>
        <p className="text-sm text-muted-foreground">RFM segmentacija, CLV analiza i distribucija nivoa lojalnosti.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Članovi</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{members.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-primary" />Ukupno bodova</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalPoints.toLocaleString("sr-RS")}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Prosečan CLV</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{Math.round(avgCLV).toLocaleString("sr-RS")} bod.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Champions</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{segmentCounts["Champions"] || 0}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tier Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribucija nivoa</CardTitle></CardHeader>
          <CardContent>
            {tierData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {tierData.map((entry, i) => <Cell key={i} fill={TIER_COLORS[entry.name] || `hsl(${i * 90}, 60%, 50%)`} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-8">Nema podataka</p>}
          </CardContent>
        </Card>

        {/* RFM Segments */}
        <Card>
          <CardHeader><CardTitle className="text-sm">RFM segmenti</CardTitle></CardHeader>
          <CardContent>
            {segmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={segmentData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))">
                    {segmentData.map((_, i) => <Cell key={i} fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-8">Nema podataka</p>}
          </CardContent>
        </Card>
      </div>

      {/* Top CLV Members */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Top 10 članova po CLV</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Partner ID</TableHead>
                <TableHead>Nivo</TableHead>
                <TableHead>Bodovi</TableHead>
                <TableHead>Životni bodovi</TableHead>
                <TableHead>RFM segment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCLVMembers.map((m: any, i) => (
                <TableRow key={m.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{m.partner_id?.slice(0, 8)}...</TableCell>
                  <TableCell><Badge variant="outline" style={{ borderColor: TIER_COLORS[m.current_tier || "Bronze"] }}>{m.current_tier || "Bronze"}</Badge></TableCell>
                  <TableCell>{(m.points_balance || 0).toLocaleString("sr-RS")}</TableCell>
                  <TableCell className="font-bold">{(m.lifetime_points || 0).toLocaleString("sr-RS")}</TableCell>
                  <TableCell><Badge variant="secondary">{m.segment}</Badge></TableCell>
                </TableRow>
              ))}
              {topCLVMembers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
