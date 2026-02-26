import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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

const m = "assets";

export const assetsRoutes = (
  <>
    <Route path="assets" element={<ProtectedRoute requiredModule={m}><AssetsHub /></ProtectedRoute>} />
    <Route path="assets/registry" element={<ProtectedRoute requiredModule={m}><AssetRegistry /></ProtectedRoute>} />
    <Route path="assets/registry/new" element={<ProtectedRoute requiredModule={m}><AssetForm /></ProtectedRoute>} />
    <Route path="assets/registry/:id" element={<ProtectedRoute requiredModule={m}><AssetForm /></ProtectedRoute>} />
    <Route path="assets/categories" element={<ProtectedRoute requiredModule={m}><AssetCategories /></ProtectedRoute>} />
    <Route path="assets/locations" element={<ProtectedRoute requiredModule={m}><AssetLocations /></ProtectedRoute>} />
    <Route path="assets/reports" element={<ProtectedRoute requiredModule={m}><AssetReports /></ProtectedRoute>} />
    <Route path="assets/offboarding" element={<ProtectedRoute requiredModule={m}><AssetOffboarding /></ProtectedRoute>} />
    <Route path="assets/depreciation" element={<ProtectedRoute requiredModule={m}><AssetDepreciation /></ProtectedRoute>} />
    <Route path="assets/disposals" element={<ProtectedRoute requiredModule={m}><AssetDisposals /></ProtectedRoute>} />
    <Route path="assets/revaluations" element={<ProtectedRoute requiredModule={m}><AssetRevaluations /></ProtectedRoute>} />
    <Route path="assets/assignments" element={<ProtectedRoute requiredModule={m}><AssetAssignments /></ProtectedRoute>} />
    <Route path="assets/reverses" element={<ProtectedRoute requiredModule={m}><AssetReverses /></ProtectedRoute>} />
    <Route path="assets/inventory-count" element={<ProtectedRoute requiredModule={m}><AssetInventoryCounts /></ProtectedRoute>} />
    <Route path="assets/inventory-count/:id" element={<ProtectedRoute requiredModule={m}><AssetInventoryCountDetail /></ProtectedRoute>} />
    <Route path="assets/fleet" element={<ProtectedRoute requiredModule={m}><FleetDashboard /></ProtectedRoute>} />
    <Route path="assets/fleet/vehicles" element={<ProtectedRoute requiredModule={m}><FleetVehicles /></ProtectedRoute>} />
    <Route path="assets/fleet/vehicles/new" element={<ProtectedRoute requiredModule={m}><FleetVehicleForm /></ProtectedRoute>} />
    <Route path="assets/fleet/vehicles/:id" element={<ProtectedRoute requiredModule={m}><FleetVehicleForm /></ProtectedRoute>} />
    <Route path="assets/fleet/fuel" element={<ProtectedRoute requiredModule={m}><FleetFuelLog /></ProtectedRoute>} />
    <Route path="assets/fleet/service" element={<ProtectedRoute requiredModule={m}><FleetServiceOrders /></ProtectedRoute>} />
    <Route path="assets/fleet/registrations" element={<ProtectedRoute requiredModule={m}><FleetRegistrations /></ProtectedRoute>} />
    <Route path="assets/fleet/insurance" element={<ProtectedRoute requiredModule={m}><FleetInsurance /></ProtectedRoute>} />
    <Route path="assets/leases" element={<ProtectedRoute requiredModule={m}><LeaseContracts /></ProtectedRoute>} />
    <Route path="assets/leases/new" element={<ProtectedRoute requiredModule={m}><LeaseContractForm /></ProtectedRoute>} />
    <Route path="assets/leases/:id" element={<ProtectedRoute requiredModule={m}><LeaseContractDetail /></ProtectedRoute>} />
  </>
);
