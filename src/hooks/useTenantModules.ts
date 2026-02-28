import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useMemo } from "react";

/**
 * Lightweight hook to check if specific tenant modules (e.g. ai-wms, ai-production)
 * are enabled. Shares the same query key as usePermissions for cache reuse.
 */
export function useTenantModules() {
  const { tenantId } = useTenant();
  const { isSuperAdmin } = useAuth();

  const { data: enabledKeys, isLoading } = useQuery({
    queryKey: ["tenant-enabled-modules", tenantId ?? "__none__"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_modules")
        .select("module_id, module_definitions!inner(key)")
        .eq("tenant_id", tenantId!)
        .eq("is_enabled", true);
      if (error) throw error;
      return new Set(
        (data || []).map((row: any) => row.module_definitions?.key as string).filter(Boolean),
      );
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const isModuleEnabled = useCallback(
    (moduleKey: string): boolean => {
      if (!enabledKeys) return false;
      return enabledKeys.has(moduleKey);
    },
    [enabledKeys],
  );

  const enabledModules = useMemo(() => enabledKeys ?? new Set<string>(), [enabledKeys]);

  return { isModuleEnabled, enabledModules, isLoading };
}
