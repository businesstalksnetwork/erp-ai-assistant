import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const AssetsHub = React.lazy(() => import("@/pages/tenant/AssetsHub"));
const AssetRegistry = React.lazy(() => import("@/pages/tenant/AssetRegistry"));
const AssetForm = React.lazy(() => import("@/pages/tenant/AssetForm"));
const AssetCategories = React.lazy(() => import("@/pages/tenant/AssetCategories"));

const m = "assets";

export const assetsRoutes = (
  <>
    <Route path="assets" element={<ProtectedRoute requiredModule={m}><AssetsHub /></ProtectedRoute>} />
    <Route path="assets/registry" element={<ProtectedRoute requiredModule={m}><AssetRegistry /></ProtectedRoute>} />
    <Route path="assets/registry/new" element={<ProtectedRoute requiredModule={m}><AssetForm /></ProtectedRoute>} />
    <Route path="assets/registry/:id" element={<ProtectedRoute requiredModule={m}><AssetForm /></ProtectedRoute>} />
    <Route path="assets/categories" element={<ProtectedRoute requiredModule={m}><AssetCategories /></ProtectedRoute>} />
  </>
);
