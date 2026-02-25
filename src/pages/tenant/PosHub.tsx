import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Monitor, MonitorSmartphone, ListChecks, Cpu, FileBarChart, DollarSign, Hash } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import type { StatItem } from "@/components/shared/StatsBar";

const links = [
  { to: "/pos/terminal", icon: MonitorSmartphone, label: "POS terminal", desc: "Prodajno mesto za direktnu naplatu" },
  { to: "/pos/sessions", icon: ListChecks, label: "Sesije", desc: "Pregled otvorenih i zatvorenih POS sesija" },
  { to: "/pos/fiscal-devices", icon: Cpu, label: "Fiskalni uređaji", desc: "Konfiguracija fiskalnih štampača i uređaja" },
  { to: "/pos/daily-report", icon: FileBarChart, label: "Dnevni izveštaj", desc: "Dnevni pregled prometa i transakcija" },
];

export default function PosHub() {
  const { tenantId } = useTenant();

  const { data: kpi } = useQuery({
    queryKey: ["pos-hub-kpi", tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [openSessions, todayTx, todaySum, monthTx] = await Promise.all([
        supabase.from("pos_sessions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "open"),
        supabase.from("pos_transactions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).gte("created_at", today),
        supabase.from("pos_transactions").select("total").eq("tenant_id", tenantId!).gte("created_at", today),
        supabase.from("pos_transactions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).gte("created_at", monthStart),
      ]);

      const todayRevenue = (todaySum.data || []).reduce((s, r) => s + (Number(r.total) || 0), 0);

      return {
        openSessions: openSessions.count || 0,
        todayTransactions: todayTx.count || 0,
        todayRevenue,
        monthTransactions: monthTx.count || 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const stats: StatItem[] = kpi
    ? [
        { label: "Otvorene sesije", value: kpi.openSessions, icon: ListChecks, color: "text-primary" },
        { label: "Danas transakcija", value: kpi.todayTransactions, icon: Hash, color: "text-accent" },
        { label: "Danas promet", value: `${(kpi.todayRevenue / 1000).toFixed(0)}k`, icon: DollarSign, color: "text-accent" },
        { label: "Mesec transakcija", value: kpi.monthTransactions, icon: FileBarChart, color: "text-primary" },
      ]
    : [];

  return (
    <BiPageLayout
      title="Maloprodaja (POS)"
      description="Upravljanje maloprodajnim operacijama — POS terminal, fiskalna kasa, sesije i dnevni izveštaji."
      icon={Monitor}
      stats={stats}
    >
      {tenantId && kpi && (
        <AiAnalyticsNarrative tenantId={tenantId} contextType="pos_performance" data={kpi as unknown as Record<string, unknown>} />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3 text-center">
                <link.icon className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.desc}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </BiPageLayout>
  );
}
