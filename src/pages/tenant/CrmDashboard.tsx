import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Users, Building2, Loader2, ArrowRight, Briefcase, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LeadFunnelChart } from "@/components/crm/LeadFunnelChart";
import { OpportunityPipelineChart } from "@/components/crm/OpportunityPipelineChart";
import { WinLossChart } from "@/components/crm/WinLossChart";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { toast } from "sonner";
import { useState } from "react";

const TIER_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  B: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  C: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  D: "bg-muted text-muted-foreground",
};

const DORMANCY_ICONS: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  active: { icon: CheckCircle2, color: "text-emerald-500" },
  at_risk: { icon: AlertTriangle, color: "text-amber-500" },
  dormant: { icon: ShieldAlert, color: "text-destructive" },
};

export default function CrmDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["crm-leads-stats", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("status").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: opps = [], isLoading: oppsLoading } = useQuery({
    queryKey: ["crm-opps-stats", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("stage, value, salesperson_id, won_amount, lost_amount").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: contactsCount = 0 } = useQuery({
    queryKey: ["crm-contacts-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("contacts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!);
      return count || 0;
    },
    enabled: !!tenantId,
  });

  const { data: companiesCount = 0 } = useQuery({
    queryKey: ["crm-partners-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("partners").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!);
      return count || 0;
    },
    enabled: !!tenantId,
  });

  const { data: wholesaleSP = [] } = useQuery({
    queryKey: ["crm-wholesale-sp", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("salespeople").select("id, first_name, last_name").eq("tenant_id", tenantId!).eq("role_type", "wholesale").eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Tier distribution
  const { data: tierDistribution = [], refetch: refetchTiers } = useQuery({
    queryKey: ["crm-tier-distribution", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("account_tier")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true);
      const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
      (data || []).forEach((p: any) => {
        const tier = p.account_tier || "D";
        if (counts[tier] !== undefined) counts[tier]++;
      });
      return Object.entries(counts).map(([tier, count]) => ({ tier, count }));
    },
    enabled: !!tenantId,
  });

  // At-risk accounts
  const { data: atRiskAccounts = [], refetch: refetchAtRisk } = useQuery({
    queryKey: ["crm-at-risk", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, name, display_name, dormancy_status, last_invoice_date, account_tier")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .in("dormancy_status", ["at_risk", "dormant"])
        .order("last_invoice_date", { ascending: true })
        .limit(10);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Expiring Quotes (within 3 days)
  const { data: expiringQuotes = [] } = useQuery({
    queryKey: ["crm-expiring-quotes", tenantId],
    queryFn: async () => {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const { data } = await supabase
        .from("quotes")
        .select("id, quote_number, partner_name, valid_until, total, currency, partners(name)")
        .eq("tenant_id", tenantId!)
        .eq("status", "sent")
        .lte("valid_until", threeDaysFromNow.toISOString().split("T")[0])
        .gte("valid_until", new Date().toISOString().split("T")[0])
        .order("valid_until", { ascending: true })
        .limit(10);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // CRM Tasks
  const { data: crmTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ["crm-open-tasks", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_tasks")
        .select("id, title, priority, status, partner_id, due_date, task_type, partners(name, display_name)")
        .eq("tenant_id", tenantId!)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l: any) => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const openOpps = opps.filter((o: any) => o.stage !== "closed_won" && o.stage !== "closed_lost" && o.stage !== "partial_won");
  const pipelineValue = openOpps.reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  const wonOpps = opps.filter((o: any) => o.stage === "closed_won");
  const lostOpps = opps.filter((o: any) => o.stage === "closed_lost");
  const partialOpps = opps.filter((o: any) => o.stage === "partial_won");
  const totalClosed = wonOpps.length + lostOpps.length + partialOpps.length;
  const winRate = totalClosed > 0 ? Math.round((wonOpps.length / totalClosed) * 100) : 0;
  const partialWinRate = totalClosed > 0 ? Math.round(((wonOpps.length + partialOpps.length) / totalClosed) * 100) : 0;
  const closedValueSum = [...wonOpps, ...lostOpps, ...partialOpps].reduce((s: number, o: any) => s + (o.value || 0), 0);
  const wonValueSum = wonOpps.reduce((s: number, o: any) => s + (o.value || 0), 0) + partialOpps.reduce((s: number, o: any) => s + (o.won_amount || 0), 0);
  const revenueWinRate = closedValueSum > 0 ? Math.round((wonValueSum / closedValueSum) * 100) : 0;

  const topKom = wholesaleSP.map((sp: any) => {
    const spOpps = openOpps.filter((o: any) => o.salesperson_id === sp.id);
    const pipeline = spOpps.reduce((s: number, o: any) => s + Number(o.value || 0), 0);
    const dealCount = spOpps.length;
    return { ...sp, pipeline, dealCount };
  }).filter(sp => sp.pipeline > 0 || sp.dealCount > 0).sort((a, b) => b.pipeline - a.pipeline).slice(0, 5);

  const fmt = (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: "RSD", maximumFractionDigits: 0 }).format(n);

  const isLoading = leadsLoading || oppsLoading;

  const handleRefreshTiers = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke("crm-tier-refresh", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      toast.success(t("tiersRefreshed"));
      refetchTiers();
      refetchAtRisk();
      refetchTasks();
    } catch {
      toast.error(t("tiersRefreshError"));
    } finally {
      setRefreshing(false);
    }
  };

  const totalTierAccounts = tierDistribution.reduce((s, d) => s + d.count, 0);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <BiPageLayout
      title={`${t("crm")} — ${t("dashboard")}`}
      icon={Target}
      stats={[
        { label: t("totalContacts"), value: contactsCount, icon: Users, color: "text-primary" },
        { label: t("totalLeads"), value: totalLeads, icon: Target, color: "text-accent" },
        { label: t("pipelineValue"), value: fmt(pipelineValue), icon: TrendingUp, color: "text-primary" },
        { label: t("fullWinRate"), value: `${winRate}%`, icon: Building2, color: "text-accent" },
        { label: t("partialWinRate"), value: `${partialWinRate}%`, icon: TrendingUp, color: "text-primary" },
        { label: t("revenueWinRate"), value: `${revenueWinRate}%`, icon: Target, color: "text-accent" },
      ]}
    >
      {tenantId && <AiModuleInsights tenantId={tenantId} module="crm" />}

      {tenantId && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="crm_pipeline"
          data={{
            totalLeads, convertedLeads, conversionRate, pipelineValue,
            openDeals: openOpps.length, winRate,
            wonCount: wonOpps.length, lostCount: lostOpps.length,
            topKomCount: topKom.length,
          }}
        />
      )}

      {/* Tier Distribution + Refresh + At-Risk Accounts */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t("tierDistribution")}</CardTitle>
            <Button size="sm" variant="outline" onClick={handleRefreshTiers} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              {t("refreshTiers")}
            </Button>
          </CardHeader>
          <CardContent>
            {totalTierAccounts === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("noResults")}</p>
            ) : (
              <div className="space-y-3">
                {tierDistribution.map(({ tier, count }) => {
                  const pct = totalTierAccounts > 0 ? Math.round((count / totalTierAccounts) * 100) : 0;
                  return (
                    <div key={tier} className="flex items-center gap-3">
                      <Badge className={`w-8 text-center justify-center ${TIER_COLORS[tier] || ""}`}>{tier}</Badge>
                      <div className="flex-1">
                        <Progress value={pct} className="h-2" />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t("accountsAtRisk")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {atRiskAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("noResults")}</p>
            ) : (
              <div className="space-y-2">
                {atRiskAccounts.map((p: any) => {
                  const dormancy = DORMANCY_ICONS[p.dormancy_status] || DORMANCY_ICONS.active;
                  const DormIcon = dormancy.icon;
                  const daysSince = p.last_invoice_date
                    ? Math.floor((Date.now() - new Date(p.last_invoice_date).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
                      onClick={() => navigate(`/crm/companies/${p.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        <DormIcon className={`h-4 w-4 ${dormancy.color}`} />
                        <span className="text-sm font-medium">{p.display_name || p.name}</span>
                        {p.account_tier && <Badge className={`text-xs ${TIER_COLORS[p.account_tier] || ""}`}>{p.account_tier}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {daysSince !== null ? `${daysSince} ${t("daysInactive")}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expiring Quotes Widget */}
      {expiringQuotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t("expiringQuotes" as any) || "Expiring Quotes"} ({expiringQuotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringQuotes.map((q: any) => {
                const daysLeft = Math.ceil((new Date(q.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
                    onClick={() => navigate("/sales/quotes")}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-sm font-medium">{q.quote_number}</span>
                      <span className="text-xs text-muted-foreground">{(q as any).partners?.name || q.partner_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{fmt(q.total)}</span>
                      <Badge variant="warning" className="text-xs">
                        {daysLeft <= 0 ? t("expired") : `${daysLeft}d`}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CRM Tasks Widget */}
      {crmTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              {t("crmTasks")} ({crmTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {crmTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
                  onClick={() => task.partner_id && navigate(`/crm/companies/${task.partner_id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={task.priority === "high" || task.priority === "urgent" ? "destructive" : "secondary"} className="text-xs shrink-0">
                      {task.priority}
                    </Badge>
                    <span className="text-sm truncate">{task.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {(task as any).partners?.display_name || (task as any).partners?.name || ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <LeadFunnelChart leads={leads as any} />
        <OpportunityPipelineChart opportunities={opps as any} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WinLossChart opportunities={opps as any} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {t("topKomercijalisti")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topKom.length > 0 ? (
              <div className="space-y-3">
                {topKom.map((sp, i) => (
                  <div key={sp.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={i < 3 ? "default" : "secondary"} className="w-6 h-6 flex items-center justify-center p-0 text-xs">{i + 1}</Badge>
                      <span className="text-sm font-medium">{sp.first_name} {sp.last_name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fmt(sp.pipeline)}</p>
                      <p className="text-xs text-muted-foreground">{sp.dealCount} {t("opportunities").toLowerCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{t("noResults")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("quickActions")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: t("addLead"), path: "/crm/leads" },
              { label: t("addOpportunity"), path: "/crm/opportunities" },
              { label: t("addContact"), path: "/crm/contacts" },
              { label: t("addCompany"), path: "/crm/companies" },
            ].map(qa => (
              <Button key={qa.path} variant="outline" className="w-full justify-between" onClick={() => navigate(qa.path)}>
                {qa.label} <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </BiPageLayout>
  );
}
