import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";

const AssetsHub = React.lazy(() => import("@/pages/tenant/AssetsHub"));
const AssetRegistry = React.lazy(() => import("@/pages/tenant/AssetRegistry"));
const AssetForm = React.lazy(() => import("@/pages/tenant/AssetForm"));
const AssetCategories = React.lazy(() => import("@/pages/tenant/AssetCategories"));
const AssetReverses = React.lazy(() => import("@/pages/tenant/AssetReverses"));
const AssetLocations = React.lazy(() => import("@/pages/tenant/AssetLocations"));
const AssetReports = React.lazy(() => import("@/pages/tenant/AssetReports"));
const AssetOffboarding = React.lazy(() => import("@/pages/tenant/AssetOffboarding"));
const AssetDepreciation = React.lazy(() => import("@/pages/tenant/AssetDepreciation"));
const AssetDisposals = React.lazy(() => import("@/pages/tenant/AssetDisposals"));
const AssetRevaluations = React.lazy(() => import("@/pages/tenant/AssetRevaluations"));
const AssetAssignments = React.lazy(() => import("@/pages/tenant/AssetAssignments"));
const AssetInventoryCounts = React.lazy(() => import("@/pages/tenant/AssetInventoryCounts"));
const AssetInventoryCountDetail = React.lazy(() => import("@/pages/tenant/AssetInventoryCountDetail"));
const FleetDashboard = React.lazy(() => import("@/pages/tenant/FleetDashboard"));
const FleetVehicles = React.lazy(() => import("@/pages/tenant/FleetVehicles"));
const FleetVehicleForm = React.lazy(() => import("@/pages/tenant/FleetVehicleForm"));
const FleetFuelLog = React.lazy(() => import("@/pages/tenant/FleetFuelLog"));
const FleetServiceOrders = React.lazy(() => import("@/pages/tenant/FleetServiceOrders"));
const FleetRegistrations = React.lazy(() => import("@/pages/tenant/FleetRegistrations"));
const FleetInsurance = React.lazy(() => import("@/pages/tenant/FleetInsurance"));
const LeaseContracts = React.lazy(() => import("@/pages/tenant/LeaseContracts"));
const LeaseContractForm = React.lazy(() => import("@/pages/tenant/LeaseContractForm"));
const LeaseContractDetail = React.lazy(() => import("@/pages/tenant/LeaseContractDetail"));
const LeaseDisclosure = React.lazy(() => import("@/pages/tenant/LeaseDisclosure"));

const m = "assets";
const B = PageErrorBoundary;

export const assetsRoutes = (
  <>
    <Route path="assets" element={<ProtectedRoute requiredModule={m}><B><AssetsHub /></B></ProtectedRoute>} />
    <Route path="assets/registry" element={<ProtectedRoute requiredModule={m}><B><AssetRegistry /></B></ProtectedRoute>} />
    <Route path="assets/registry/new" element={<ProtectedRoute requiredModule={m}><B><AssetForm /></B></ProtectedRoute>} />
    <Route path="assets/registry/:id" element={<ProtectedRoute requiredModule={m}><B><AssetForm /></B></ProtectedRoute>} />
    <Route path="assets/categories" element={<ProtectedRoute requiredModule={m}><B><AssetCategories /></B></ProtectedRoute>} />
    <Route path="assets/locations" element={<ProtectedRoute requiredModule={m}><B><AssetLocations /></B></ProtectedRoute>} />
    <Route path="assets/reports" element={<ProtectedRoute requiredModule={m}><B><AssetReports /></B></ProtectedRoute>} />
    <Route path="assets/offboarding" element={<ProtectedRoute requiredModule={m}><B><AssetOffboarding /></B></ProtectedRoute>} />
    <Route path="assets/depreciation" element={<ProtectedRoute requiredModule={m}><B><AssetDepreciation /></B></ProtectedRoute>} />
    <Route path="assets/disposals" element={<ProtectedRoute requiredModule={m}><B><AssetDisposals /></B></ProtectedRoute>} />
    <Route path="assets/revaluations" element={<ProtectedRoute requiredModule={m}><B><AssetRevaluations /></B></ProtectedRoute>} />
    <Route path="assets/assignments" element={<ProtectedRoute requiredModule={m}><B><AssetAssignments /></B></ProtectedRoute>} />
    <Route path="assets/reverses" element={<ProtectedRoute requiredModule={m}><B><AssetReverses /></B></ProtectedRoute>} />
    <Route path="assets/inventory-count" element={<ProtectedRoute requiredModule={m}><B><AssetInventoryCounts /></B></ProtectedRoute>} />
    <Route path="assets/inventory-count/:id" element={<ProtectedRoute requiredModule={m}><B><AssetInventoryCountDetail /></B></ProtectedRoute>} />
    <Route path="assets/fleet" element={<ProtectedRoute requiredModule={m}><B><FleetDashboard /></B></ProtectedRoute>} />
    <Route path="assets/fleet/vehicles" element={<ProtectedRoute requiredModule={m}><B><FleetVehicles /></B></ProtectedRoute>} />
    <Route path="assets/fleet/vehicles/new" element={<ProtectedRoute requiredModule={m}><B><FleetVehicleForm /></B></ProtectedRoute>} />
    <Route path="assets/fleet/vehicles/:id" element={<ProtectedRoute requiredModule={m}><B><FleetVehicleForm /></B></ProtectedRoute>} />
    <Route path="assets/fleet/fuel" element={<ProtectedRoute requiredModule={m}><B><FleetFuelLog /></B></ProtectedRoute>} />
    <Route path="assets/fleet/service" element={<ProtectedRoute requiredModule={m}><B><FleetServiceOrders /></B></ProtectedRoute>} />
    <Route path="assets/fleet/registrations" element={<ProtectedRoute requiredModule={m}><B><FleetRegistrations /></B></ProtectedRoute>} />
    <Route path="assets/fleet/insurance" element={<ProtectedRoute requiredModule={m}><B><FleetInsurance /></B></ProtectedRoute>} />
    <Route path="assets/leases" element={<ProtectedRoute requiredModule={m}><B><LeaseContracts /></B></ProtectedRoute>} />
    <Route path="assets/leases/new" element={<ProtectedRoute requiredModule={m}><B><LeaseContractForm /></B></ProtectedRoute>} />
    <Route path="assets/leases/disclosure" element={<ProtectedRoute requiredModule={m}><B><LeaseDisclosure /></B></ProtectedRoute>} />
    <Route path="assets/leases/:id" element={<ProtectedRoute requiredModule={m}><B><LeaseContractDetail /></B></ProtectedRoute>} />
  </>
);
