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
      case "production_manager":
      case "production_worker":
        return ManagerDashboard;
      case "accountant":
      case "finance_director":
        return AccountantDashboard;
      case "sales":
      case "sales_manager":
      case "sales_rep":
        return SalesDashboard;
      case "hr":
      case "hr_manager":
      case "hr_staff":
        return HrDashboard;
      case "store":
      case "store_manager":
      case "cashier":
      case "warehouse_manager":
      case "warehouse_worker":
      case "viewer":
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
