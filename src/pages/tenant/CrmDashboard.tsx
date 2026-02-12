import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Users, Building2, Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
      const { data } = await supabase.from("opportunities").select("stage, value").eq("tenant_id", tenantId!);
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

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l: any) => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const openOpps = opps.filter((o: any) => o.stage !== "closed_won" && o.stage !== "closed_lost");
  const pipelineValue = openOpps.reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  const wonValue = opps.filter((o: any) => o.stage === "closed_won").reduce((sum: number, o: any) => sum + (o.value || 0), 0);

  const fmt = (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: "RSD", maximumFractionDigits: 0 }).format(n);

  const leadsByStatus = ["new", "contacted", "qualified", "converted", "lost"].map(s => ({
    status: s,
    count: leads.filter((l: any) => l.status === s).length,
  }));

  const isLoading = leadsLoading || oppsLoading;

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("crm")} — {t("dashboard")}</h1>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm/leads")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("leads")}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">{t("converted")}: {convertedLeads} ({conversionRate}%)</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm/opportunities")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("opportunities")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(pipelineValue)}</div>
            <p className="text-xs text-muted-foreground">{openOpps.length} {t("open").toLowerCase()} · {t("closed_won")}: {fmt(wonValue)}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm/contacts")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("contacts")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contactsCount}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm/companies")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("companies")}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companiesCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Funnel */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("leads")} — {t("status")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leadsByStatus.map(ls => (
                <div key={ls.status} className="flex items-center justify-between">
                  <Badge variant={ls.status === "converted" ? "default" : ls.status === "lost" ? "destructive" : "secondary"}>
                    {t(ls.status as any) || ls.status}
                  </Badge>
                  <span className="text-sm font-medium">{ls.count}</span>
                </div>
              ))}
            </div>
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
    </div>
  );
}
