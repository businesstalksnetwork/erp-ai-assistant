import { usePermissions, type PermissionAction } from "@/hooks/usePermissions";
import type { ModuleGroup } from "@/config/rolePermissions";

interface ActionGuardProps {
  module: ModuleGroup;
  action: PermissionAction;
  children: React.ReactNode;
  /** If true, renders children but disabled (wraps in span with opacity) */
  showDisabled?: boolean;
}

export function ActionGuard({ module, action, children, showDisabled }: ActionGuardProps) {
  const { canPerform } = usePermissions();

  if (canPerform(module, action)) return <>{children}</>;

  if (showDisabled) {
    return <span className="opacity-40 pointer-events-none select-none">{children}</span>;
  }

  return null;
}
