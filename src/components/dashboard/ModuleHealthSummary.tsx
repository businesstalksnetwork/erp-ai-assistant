import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Receipt, Package, UserCheck, FolderOpen, Target } from "lucide-react";

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
          {modules.map((m) => (
            <div key={m.key} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50">
              <m.icon className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">{m.count}</span>
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
