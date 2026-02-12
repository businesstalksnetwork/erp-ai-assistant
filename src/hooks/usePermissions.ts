import { useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { rolePermissions, type ModuleGroup, type TenantRole } from "@/config/rolePermissions";

export function usePermissions() {
  const { tenantId, role, isLoading } = useTenant();

  const effectiveRole: TenantRole = (role as TenantRole) || "user";

  const allowedModules = useMemo(
    () => new Set(rolePermissions[effectiveRole] ?? rolePermissions.user),
    [effectiveRole],
  );

  const canAccess = (module: ModuleGroup): boolean => allowedModules.has(module);

  return { canAccess, role: effectiveRole, isLoading, tenantId };
}
