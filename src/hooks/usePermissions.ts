import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { rolePermissions, type ModuleGroup, type TenantRole } from "@/config/rolePermissions";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

/** Modules that are always accessible regardless of tenant_modules config */
const isAlwaysOn = (m: ModuleGroup): boolean =>
  m === "dashboard" || m === "settings" || m.startsWith("settings-");

export function usePermissions() {
  const { tenantId, role, dataScope: tenantDataScope, isLoading: tenantLoading } = useTenant();
  const { isSuperAdmin } = useAuth();

  const effectiveRole: TenantRole = isSuperAdmin ? "admin" : ((role as TenantRole) || "user");

  const roleModules = useMemo(
    () => new Set(rolePermissions[effectiveRole] ?? rolePermissions.user),
    [effectiveRole],
  );

  // Fetch enabled modules for this tenant from DB
  const shouldFetch = !!tenantId;
  const { data: enabledModuleKeys, isLoading: modulesLoading } = useQuery({
    queryKey: ["tenant-enabled-modules", tenantId ?? "__none__"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_modules")
        .select("module_id, module_definitions!inner(key)")
        .eq("tenant_id", tenantId!)
        .eq("is_enabled", true);
      if (error) throw error;
      return new Set(
        (data || []).map((row: any) => row.module_definitions?.key as string).filter(Boolean)
      );
    },
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch action-level permissions for current role + tenant
  const { data: actionPermissions, isLoading: permsLoading } = useQuery({
    queryKey: ["tenant-role-permissions", tenantId ?? "__none__", effectiveRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_role_permissions")
        .select("module, action, allowed")
        .eq("tenant_id", tenantId!)
        .eq("role", effectiveRole);
      if (error) throw error;
      const map = new Map<string, boolean>();
      (data || []).forEach((row: any) => {
        map.set(`${row.module}:${row.action}`, row.allowed);
      });
      return map;
    },
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = tenantLoading || modulesLoading || permsLoading;

  /** Check action-level permission for a module */
  const canPerform = (module: ModuleGroup, action: PermissionAction): boolean => {
    if (isSuperAdmin) return true;

    // Role must allow module first
    if (!roleModules.has(module)) return false;

    // Core modules always on for view
    if (action === "view" && isAlwaysOn(module)) return true;

    // Check tenant module enabled (non-core)
    if (!isAlwaysOn(module)) {
      if (!enabledModuleKeys) return false;
      if (!enabledModuleKeys.has(module)) return false;
    }

    // If we have custom action permissions, use them
    if (actionPermissions && actionPermissions.size > 0) {
      const key = `${module}:${action}`;
      const allowed = actionPermissions.get(key);
      return allowed === true;
    }

    // Fallback: standard actions allowed by default
    if (["view", "create", "edit", "delete"].includes(action)) return true;
    return false;
  };

  /** Backward-compatible module-level access check */
  const canAccess = (module: ModuleGroup): boolean => canPerform(module, "view");

  const dataScope = tenantDataScope || "all";

  return { canAccess, canPerform, role: effectiveRole, isLoading, tenantId, dataScope };
}
