import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAccountingValidation } from "@/hooks/useAccountingValidation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, AlertCircle, AlertTriangle, Info, Loader2, RefreshCw, Sparkles, Scale, FileCheck, Users, Building2, BarChart3, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const categoryConfig = {
  journal: { icon: BookOpen, label: "Journal Entries", label_sr: "Nalozi za knjiženje" },
  vat: { icon: Scale, label: "VAT / PDV", label_sr: "PDV" },
  invoicing: { icon: FileCheck, label: "Invoicing", label_sr: "Fakturisanje" },
  payroll: { icon: Users, label: "Payroll", label_sr: "Plate" },
  assets: { icon: Building2, label: "Fixed Assets", label_sr: "Osnovna sredstva" },
  reporting: { icon: BarChart3, label: "Reports", label_sr: "Izveštaji" },
  general: { icon: ShieldCheck, label: "General", label_sr: "Opšte" },
};

const severityConfig = {
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-warning/10", badge: "outline" as const },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20", badge: "secondary" as const },
};

export default function ComplianceDashboard() {
  const { tenantId } = useTenant();
  const { locale } = useLanguage();
  const sr = locale === "sr";
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useAccountingValidation(tenantId);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["compliance-check"] });
  };

  // Group checks by category
  const grouped = (data?.checks || []).reduce<Record<string, Array<any>>>((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title={sr ? "Provera usklađenosti" : "Compliance Checker"}
        description={sr ? "Automatska provera usklađenosti sa srpskim računovodstvenim propisima" : "Automated compliance checks against Serbian accounting regulations"}
        actions={
          <Button onClick={handleRefresh} disabled={isFetching} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {sr ? "Ponovo proveri" : "Re-check"}
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">
            {sr ? "Provera usklađenosti u toku..." : "Running compliance checks..."}
          </span>
        </div>
      ) : data ? (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{data.stats.total}</div>
                <p className="text-xs text-muted-foreground">{sr ? "Ukupno provera" : "Total checks"}</p>
              </CardContent>
            </Card>
            <Card className={data.stats.errors > 0 ? "border-destructive/50" : ""}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-destructive">{data.stats.errors}</div>
                <p className="text-xs text-muted-foreground">{sr ? "Greške" : "Errors"}</p>
              </CardContent>
            </Card>
            <Card className={data.stats.warnings > 0 ? "border-amber-500/50" : ""}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-amber-500">{data.stats.warnings}</div>
                <p className="text-xs text-muted-foreground">{sr ? "Upozorenja" : "Warnings"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-500">{data.stats.info}</div>
                <p className="text-xs text-muted-foreground">{sr ? "Informacije" : "Info"}</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Summary */}
          {data.ai_summary && (
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {sr ? "AI Analiza usklađenosti" : "AI Compliance Analysis"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{data.ai_summary}</p>
                {data.priority_actions && data.priority_actions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {sr ? "Prioritetne akcije:" : "Priority actions:"}
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                      {data.priority_actions.map((action, i) => (
                        <li key={i} className="text-sm">{action}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Checks by category */}
          {data.stats.total === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">
                  {sr ? "Sve je u redu!" : "All Clear!"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {sr ? "Nisu pronađeni problemi sa usklađenošću." : "No compliance issues found."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-4">
                {Object.entries(grouped).sort(([, a], [, b]) => {
                  const aErrors = a.filter(c => c.severity === "error").length;
                  const bErrors = b.filter(c => c.severity === "error").length;
                  return bErrors - aErrors;
                }).map(([category, checks]) => {
                  const config = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.general;
                  const CatIcon = config.icon;

                  return (
                    <Card key={category}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CatIcon className="h-4 w-4" />
                          {sr ? config.label_sr : config.label}
                          <Badge variant="secondary" className="ml-auto">{checks.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {checks.sort((a: any, b: any) => {
                          const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
                          return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
                        }).map((check: any, i: number) => {
                          const sev = severityConfig[check.severity as keyof typeof severityConfig];
                          const SevIcon = sev.icon;

                          return (
                            <div key={i} className={`rounded-lg p-3 ${sev.bg}`}>
                              <div className="flex items-start gap-2">
                                <SevIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${sev.color}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">
                                      {sr ? check.title_sr : check.title}
                                    </span>
                                    <Badge variant={sev.badge} className="text-[10px] h-4">
                                      {check.affected_count}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {sr ? check.description_sr : check.description}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground/70 mt-1 italic">
                                    📜 {check.law_reference}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {sr ? "Poslednja provera:" : "Last checked:"} {new Date(data.checked_at).toLocaleString(sr ? "sr-RS" : "en-US")}
          </p>
        </>
      ) : null}
    </div>
  );
}
