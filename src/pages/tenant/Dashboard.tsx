import React, { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const CustomizableDashboard = React.lazy(() => import("@/components/dashboard/CustomizableDashboard"));

export default function TenantDashboard() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <CustomizableDashboard />
    </Suspense>
  );
}
