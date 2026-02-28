import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Star, Gift, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
        .select("id, points_balance, lifetime_points, current_tier, enrolled_at, partner_id, partners(name)")
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
        .limit(20);
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

  const totalMembers = members.length;
  const totalPoints = members.reduce((sum, m) => sum + (m.points_balance || 0), 0);

  const tierCounts = members.reduce((acc, m) => {
    acc[m.current_tier] = (acc[m.current_tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(tierCounts).map(([tier, count]) => ({
    name: t((`tier${tier.charAt(0).toUpperCase() + tier.slice(1)}`) as any),
    value: count,
    color: TIER_COLORS[tier] || "hsl(var(--muted))",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("loyaltyDashboard" as any)}</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("totalMembers" as any)}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{totalMembers}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("totalPointsOutstanding" as any)}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" /><span className="text-2xl font-bold">{totalPoints.toLocaleString()}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("redemptionsThisMonth" as any)}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Gift className="h-5 w-5 text-green-500" /><span className="text-2xl font-bold">{redemptionCount}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("loyaltyTierDistribution" as any)}</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={40}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("recentLoyaltyActivity" as any)}</CardTitle></CardHeader>
        <CardContent>
          {recentTx.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div>
                    <span className="text-sm">{tx.description}</span>
                    <span className="text-xs text-muted-foreground ml-2">{format(new Date(tx.created_at), "dd MMM yyyy HH:mm")}</span>
                  </div>
                  <Badge variant={tx.points > 0 ? "default" : "destructive"}>
                    {tx.points > 0 ? "+" : ""}{tx.points}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
