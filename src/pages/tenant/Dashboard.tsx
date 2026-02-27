import React, { Suspense } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const AdminDashboard = React.lazy(() => import("@/components/dashboard/roles/AdminDashboard"));
const ManagerDashboard = React.lazy(() => import("@/components/dashboard/roles/ManagerDashboard"));
const AccountantDashboard = React.lazy(() => import("@/components/dashboard/roles/AccountantDashboard"));
const SalesDashboard = React.lazy(() => import("@/components/dashboard/roles/SalesDashboard"));
const HrDashboard = React.lazy(() => import("@/components/dashboard/roles/HrDashboard"));
const StoreDashboard = React.lazy(() => import("@/components/dashboard/roles/StoreDashboard"));

export default function TenantDashboard() {
  const { role } = useTenant();
  const { isSuperAdmin } = useAuth();

  const effectiveRole = isSuperAdmin ? "admin" : role;

  const DashboardComponent = (() => {
    switch (effectiveRole) {
      case "admin":
      case "super_admin":
        return AdminDashboard;
      case "manager":
        return ManagerDashboard;
      case "accountant":
        return AccountantDashboard;
      case "sales":
        return SalesDashboard;
      case "hr":
        return HrDashboard;
      case "store":
      case "user":
      default:
        return StoreDashboard;
    }
  })();

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <DashboardComponent />
    </Suspense>
  );
}
