import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { rolePermissions, type ModuleGroup, type TenantRole } from "@/config/rolePermissions";

/** Modules that are always accessible regardless of tenant_modules config */
const ALWAYS_ON: ModuleGroup[] = [
  "dashboard", "settings",
  "settings-users", "settings-approvals", "settings-business-rules",
  "settings-tax-rates", "settings-currencies", "settings-audit-log",
  "settings-events", "settings-integrations",
];

export function usePermissions() {
  const { tenantId, role, isLoading: tenantLoading } = useTenant();
  const { isSuperAdmin } = useAuth();

  const effectiveRole: TenantRole = isSuperAdmin ? "admin" : ((role as TenantRole) || "user");

  const roleModules = useMemo(
    () => new Set(rolePermissions[effectiveRole] ?? rolePermissions.user),
    [effectiveRole],
  );

  // Fetch enabled modules for this tenant from DB
  const { data: enabledModuleKeys, isLoading: modulesLoading } = useQuery({
    queryKey: ["tenant-enabled-modules", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_modules")
        .select("module_id, module_definitions!inner(key)")
        .eq("tenant_id", tenantId)
        .eq("is_enabled", true);
      if (error) throw error;
      return new Set(
        (data || []).map((row: any) => row.module_definitions?.key as string).filter(Boolean)
      );
    },
    enabled: !!tenantId && !isSuperAdmin,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = tenantLoading || (!isSuperAdmin && modulesLoading);

  const canAccess = (module: ModuleGroup): boolean => {
    // Role must allow it first
    if (!roleModules.has(module)) return false;

    // Super admins bypass tenant module checks
    if (isSuperAdmin) return true;

    // Core modules always on
    if (ALWAYS_ON.includes(module)) return true;

    // If we haven't loaded tenant modules yet, allow (avoid flash)
    if (!enabledModuleKeys) return true;

    // Check tenant has this module enabled
    return enabledModuleKeys.has(module);
  };

  return { canAccess, role: effectiveRole, isLoading, tenantId };
}
