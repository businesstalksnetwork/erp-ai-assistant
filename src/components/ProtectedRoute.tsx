import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/components/ui/sonner";
import { useEffect, useRef } from "react";
import type { ModuleGroup } from "@/config/rolePermissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requiredModule?: ModuleGroup;
}

export function ProtectedRoute({ children, requireSuperAdmin, requiredModule }: ProtectedRouteProps) {
  const { user, loading, isSuperAdmin } = useAuth();
  const { canAccess, isLoading: permLoading } = usePermissions();
  const toastShown = useRef(false);

  const denied = requiredModule && !permLoading && user && !isSuperAdmin && !canAccess(requiredModule);

  useEffect(() => {
    if (denied && !toastShown.current) {
      toastShown.current = true;
      toast("Access denied – you don't have permission to view this page.");
    }
  }, [denied]);

  if (loading || (requiredModule && permLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requireSuperAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (denied) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
