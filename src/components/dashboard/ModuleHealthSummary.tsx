import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Receipt, Package, UserCheck, FolderOpen, Target } from "lucide-react";
import { subHours } from "date-fns";

interface Props {
  tenantId: string;
}

export function ModuleHealthSummary({ tenantId }: Props) {
  const { t } = useLanguage();
  const { canAccess } = usePermissions();

  const { data: counts = {} } = useQuery({
    queryKey: ["module-health", tenantId],
    queryFn: async () => {
      const results: Record<string, number> = {};
      const queries = [
        { key: "contacts", table: "contacts" as const },
        { key: "invoices", table: "invoices" as const },
        { key: "leads", table: "leads" as const },
        { key: "products", table: "products" as const },
        { key: "employees", table: "employees" as const },
        { key: "documents", table: "documents" as const },
      ];
      await Promise.all(
        queries.map(async ({ key, table }) => {
          const { count } = await supabase
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId);
          results[key] = count || 0;
        }),
      );
      return results;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: eventActivity = {} as Record<string, { total: number; errors: number }> } = useQuery({
    queryKey: ["module-event-activity", tenantId],
    queryFn: async () => {
      const since = subHours(new Date(), 24).toISOString();
      const { data } = await supabase
        .from("module_events")
        .select("source_module, status")
        .eq("tenant_id", tenantId)
        .gte("created_at", since);
      const result: Record<string, { total: number; errors: number }> = {};
      (data || []).forEach((ev: any) => {
        const mod = ev.source_module || "unknown";
        if (!result[mod]) result[mod] = { total: 0, errors: 0 };
        result[mod].total++;
        if (ev.status === "failed") result[mod].errors++;
      });
      return result;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
  });

  const modules = [
    { key: "crm", label: t("crm"), icon: Users, count: (counts.contacts || 0) + (counts.leads || 0), module: "crm" as const },
    { key: "accounting", label: t("accounting"), icon: Receipt, count: counts.invoices || 0, module: "accounting" as const },
    { key: "inventory", label: t("inventory"), icon: Package, count: counts.products || 0, module: "inventory" as const },
    { key: "hr", label: t("hr"), icon: UserCheck, count: counts.employees || 0, module: "hr" as const },
    { key: "documents", label: t("documents"), icon: FolderOpen, count: counts.documents || 0, module: "documents" as const },
  ].filter((m) => canAccess(m.module));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          {t("moduleHealth") || "Module Health"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          {modules.map((m) => {
            const activity = eventActivity[m.key];
            return (
              <div key={m.key} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50">
                <m.icon className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold">{m.count}</span>
                <span className="text-xs text-muted-foreground">{m.label}</span>
                {activity && (
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {activity.total} {t("events") || "events"}
                    {activity.errors > 0 && (
                      <span className="text-destructive ml-1">/ {activity.errors} {t("error") || "err"}</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
