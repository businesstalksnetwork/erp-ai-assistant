import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Star, Gift, TrendingUp, Target, Zap, Award, BarChart3 } from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";

const TIER_COLORS: Record<string, string> = {
  bronze: "hsl(30, 60%, 50%)",
  silver: "hsl(0, 0%, 65%)",
  gold: "hsl(45, 90%, 50%)",
  platinum: "hsl(210, 15%, 55%)",
};

export default function LoyaltyDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: members = [] } = useQuery({
    queryKey: ["loyalty_members", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_members")
        .select("id, points_balance, lifetime_points, current_tier, enrolled_at, partner_id, first_name, last_name, phone, email, card_number, status, partners(name)")
        .eq("tenant_id", tenantId!)
        .order("lifetime_points", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: recentTx = [] } = useQuery({
    queryKey: ["loyalty_transactions_recent", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_transactions")
        .select("id, points, type, description, created_at, member_id")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: redemptionCount = 0 } = useQuery({
    queryKey: ["loyalty_redemptions_month", tenantId],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("loyalty_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .gte("redeemed_at", startOfMonth.toISOString());
      return count || 0;
    },
    enabled: !!tenantId,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["loyalty_campaigns_active", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("loyalty_campaigns") as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .gte("end_date", new Date().toISOString().split("T")[0]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: multiplierRules = [] } = useQuery({
    queryKey: ["loyalty_multipliers", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("loyalty_multiplier_rules") as any)
        .select("*").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const totalMembers = members.length;
  const activeMembers = members.filter(m => (m as any).status === "active").length;
  const totalPoints = members.reduce((sum, m) => sum + (m.points_balance || 0), 0);
  const totalLifetime = members.reduce((sum, m) => sum + (m.lifetime_points || 0), 0);
  const avgLifetime = totalMembers > 0 ? Math.round(totalLifetime / totalMembers) : 0;

  // Enrollments this month
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
  const newThisMonth = members.filter(m => new Date(m.enrolled_at) >= startOfMonth).length;

  // Points earned vs redeemed
  const pointsEarned = recentTx.filter(tx => tx.points > 0).reduce((s, tx) => s + tx.points, 0);
  const pointsRedeemed = Math.abs(recentTx.filter(tx => tx.points < 0).reduce((s, tx) => s + tx.points, 0));

  // Tier distribution
  const tierCounts = members.reduce((acc, m) => {
    acc[m.current_tier] = (acc[m.current_tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(tierCounts).map(([tier, count]) => ({
    name: t((`tier${tier.charAt(0).toUpperCase() + tier.slice(1)}`) as any),
    value: count,
    color: TIER_COLORS[tier] || "hsl(var(--muted))",
  }));

  // Daily enrollment trend (last 30 days)
  const enrollTrend = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    const ds = format(d, "MM-dd");
    const count = members.filter(m => format(new Date(m.enrolled_at), "MM-dd") === ds).length;
    return { date: ds, count };
  });

  // Points flow bar chart
  const earnTypes = recentTx.reduce((acc, tx) => {
    const type = tx.type || "other";
    if (!acc[type]) acc[type] = 0;
    acc[type] += Math.abs(tx.points);
    return acc;
  }, {} as Record<string, number>);
  const flowData = Object.entries(earnTypes).map(([type, points]) => ({ type, points }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("loyaltyDashboard" as any)}</h1>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("totalMembers" as any)}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{totalMembers}</span></div></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("activeMembers" as any) || "Active"}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Zap className="h-5 w-5 text-green-500" /><span className="text-2xl font-bold">{activeMembers}</span></div></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("totalPointsOutstanding" as any)}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" /><span className="text-2xl font-bold">{totalPoints.toLocaleString()}</span></div></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("newThisMonth" as any) || "New This Month"}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-blue-500" /><span className="text-2xl font-bold">{newThisMonth}</span></div></CardContent>
        </Card>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("avgLifetimePoints" as any) || "Avg Lifetime"}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Target className="h-5 w-5 text-orange-500" /><span className="text-2xl font-bold">{avgLifetime.toLocaleString()}</span></div></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("pointsEarned" as any) || "Earned (Recent)"}</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold text-green-600">+{pointsEarned.toLocaleString()}</span></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("pointsRedeemed" as any) || "Redeemed"}</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold text-destructive">-{pointsRedeemed.toLocaleString()}</span></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("redemptionsThisMonth" as any)}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Gift className="h-5 w-5 text-green-500" /><span className="text-2xl font-bold">{redemptionCount}</span></div></CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">{t("loyaltyTierDistribution" as any)}</CardTitle></CardHeader>
          <CardContent>{pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          ) : <span className="text-muted-foreground text-sm">—</span>}</CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-sm">Enrollment Trend (30d)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={enrollTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /></LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-sm">Points by Type</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={flowData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="type" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Active Campaigns & Multipliers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-1"><Award className="h-4 w-4" /> Active Campaigns</CardTitle></CardHeader>
          <CardContent>{campaigns.length === 0 ? <p className="text-sm text-muted-foreground">No active campaigns</p> : (
            <div className="space-y-2">{campaigns.map((c: any) => (
              <div key={c.id} className="flex justify-between items-center text-sm border-b border-border/30 pb-1">
                <div><span className="font-medium">{c.name}</span><span className="text-xs text-muted-foreground ml-2">{c.campaign_type}</span></div>
                <Badge variant="outline">{c.start_date} → {c.end_date}</Badge>
              </div>
            ))}</div>
          )}</CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-1"><Zap className="h-4 w-4" /> Active Multipliers</CardTitle></CardHeader>
          <CardContent>{multiplierRules.length === 0 ? <p className="text-sm text-muted-foreground">No active multipliers</p> : (
            <div className="space-y-2">{multiplierRules.map((r: any) => (
              <div key={r.id} className="flex justify-between items-center text-sm border-b border-border/30 pb-1">
                <span className="font-medium">{r.name}</span>
                <Badge>{r.multiplier}x</Badge>
              </div>
            ))}</div>
          )}</CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card><CardHeader><CardTitle>{t("recentLoyaltyActivity" as any)}</CardTitle></CardHeader>
        <CardContent>{recentTx.length === 0 ? <p className="text-muted-foreground text-sm">No activity yet.</p> : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {recentTx.slice(0, 20).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border-b border-border/40 pb-2">
                <div><span className="text-sm">{tx.description}</span><span className="text-xs text-muted-foreground ml-2">{format(new Date(tx.created_at), "dd MMM yyyy HH:mm")}</span></div>
                <Badge variant={tx.points > 0 ? "default" : "destructive"}>{tx.points > 0 ? "+" : ""}{tx.points}</Badge>
              </div>
            ))}
          </div>
        )}</CardContent>
      </Card>
    </div>
  );
}

function UserPlus(props: any) {
  return <Users {...props} />;
}
