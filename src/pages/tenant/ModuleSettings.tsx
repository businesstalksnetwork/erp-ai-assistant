import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Sparkles, Gift } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const MODULE_CARDS = [
  { key: "ai-wms", icon: Brain, titleKey: "aiWarehouse", descKey: "aiWarehouseDesc" },
  { key: "ai-production", icon: Sparkles, titleKey: "aiProduction", descKey: "aiProductionDesc" },
  { key: "loyalty", icon: Gift, titleKey: "loyaltyModule", descKey: "loyaltyModuleDesc" },
] as const;

export default function ModuleSettings() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  // Fetch all module_definitions
  const { data: moduleDefs } = useQuery({
    queryKey: ["module-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("module_definitions").select("*");
      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity,
  });

  // Fetch tenant_modules for this tenant
  const { data: tenantModules, isLoading } = useQuery({
    queryKey: ["tenant-modules-settings", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_modules")
        .select("module_id, is_enabled, module_definitions!inner(key)")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) => {
      const def = moduleDefs?.find((d: any) => d.key === moduleKey);
      if (!def) throw new Error("Module definition not found");

      const existing = tenantModules?.find((tm: any) => tm.module_definitions?.key === moduleKey);
      if (existing) {
        const { error } = await supabase
          .from("tenant_modules")
          .update({ is_enabled: enabled, enabled_at: enabled ? new Date().toISOString() : null })
          .eq("tenant_id", tenantId!)
          .eq("module_id", def.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenant_modules").insert({
          tenant_id: tenantId!,
          module_id: def.id,
          is_enabled: enabled,
          enabled_at: enabled ? new Date().toISOString() : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-modules-settings", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-enabled-modules", tenantId] });
      toast.success(t("saved" as any));
    },
    onError: () => toast.error(t("errorOccurred" as any)),
  });

  const isEnabled = (moduleKey: string): boolean => {
    if (!tenantModules) return false;
    const tm = tenantModules.find((m: any) => m.module_definitions?.key === moduleKey);
    return tm?.is_enabled ?? false;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("modules" as any)}</h1>
        <p className="text-muted-foreground">{t("modulesDescription" as any)}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULE_CARDS.map(({ key, icon: Icon, titleKey, descKey }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{t(titleKey as any)}</CardTitle>
              </div>
              <Switch
                checked={isEnabled(key)}
                onCheckedChange={(checked) => toggleMutation.mutate({ moduleKey: key, enabled: checked })}
                disabled={isLoading || toggleMutation.isPending}
              />
            </CardHeader>
            <CardContent>
              <CardDescription>{t(descKey as any)}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
