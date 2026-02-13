import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, Users, Building2, Loader2, ArrowRight, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatsBar } from "@/components/shared/StatsBar";
import { LeadFunnelChart } from "@/components/crm/LeadFunnelChart";
import { OpportunityPipelineChart } from "@/components/crm/OpportunityPipelineChart";
import { WinLossChart } from "@/components/crm/WinLossChart";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";

export default function CrmDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

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
      const { data } = await supabase.from("opportunities").select("stage, value, salesperson_id").eq("tenant_id", tenantId!);
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
    queryKey: ["crm-companies-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("companies").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!);
      return count || 0;
    },
    enabled: !!tenantId,
  });

  // Top Komercijalisti query
  const { data: wholesaleSP = [] } = useQuery({
    queryKey: ["crm-wholesale-sp", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("salespeople").select("id, first_name, last_name").eq("tenant_id", tenantId!).eq("role_type", "wholesale").eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l: any) => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const openOpps = opps.filter((o: any) => o.stage !== "closed_won" && o.stage !== "closed_lost");
  const pipelineValue = openOpps.reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  const wonOpps = opps.filter((o: any) => o.stage === "closed_won");
  const lostOpps = opps.filter((o: any) => o.stage === "closed_lost");
  const winRate = wonOpps.length + lostOpps.length > 0 ? Math.round((wonOpps.length / (wonOpps.length + lostOpps.length)) * 100) : 0;

  // Compute top komercijalisti by pipeline value
  const topKom = wholesaleSP.map((sp: any) => {
    const spOpps = openOpps.filter((o: any) => o.salesperson_id === sp.id);
    const pipeline = spOpps.reduce((s: number, o: any) => s + Number(o.value || 0), 0);
    const dealCount = spOpps.length;
    return { ...sp, pipeline, dealCount };
  }).filter(sp => sp.pipeline > 0 || sp.dealCount > 0).sort((a, b) => b.pipeline - a.pipeline).slice(0, 5);

  const fmt = (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: "RSD", maximumFractionDigits: 0 }).format(n);

  const isLoading = leadsLoading || oppsLoading;

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`${t("crm")} — ${t("dashboard")}`} icon={Target} />

      <StatsBar
        stats={[
          { label: t("totalContacts"), value: contactsCount, icon: Users, color: "text-primary" },
          { label: t("totalLeads"), value: totalLeads, icon: Target, color: "text-accent" },
          { label: t("pipelineValue"), value: fmt(pipelineValue), icon: TrendingUp, color: "text-primary" },
          { label: t("winRate"), value: `${winRate}%`, icon: Building2, color: "text-accent" },
        ]}
      />

      {tenantId && <AiModuleInsights tenantId={tenantId} module="crm" />}

      {tenantId && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="planning"
          data={{
            totalLeads,
            convertedLeads,
            conversionRate,
            pipelineValue,
            openDeals: openOpps.length,
            winRate,
            wonCount: wonOpps.length,
            lostCount: lostOpps.length,
            topKomCount: topKom.length,
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <LeadFunnelChart leads={leads as any} />
        <OpportunityPipelineChart opportunities={opps as any} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WinLossChart opportunities={opps as any} />

        {/* Top Komercijalisti Widget */}
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

        {/* Quick Actions */}
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
    </div>
  );
}
