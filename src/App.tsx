import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

import SuperAdminLayout from "@/layouts/SuperAdminLayout";
import TenantLayout from "@/layouts/TenantLayout";

// Lazy-loaded super admin pages
const SuperAdminDashboard = React.lazy(() => import("@/pages/super-admin/Dashboard"));
const TenantManagement = React.lazy(() => import("@/pages/super-admin/TenantManagement"));
const ModuleManagement = React.lazy(() => import("@/pages/super-admin/ModuleManagement"));
const UserManagement = React.lazy(() => import("@/pages/super-admin/UserManagement"));
const PlatformMonitoring = React.lazy(() => import("@/pages/super-admin/PlatformMonitoring"));
const IntegrationSupport = React.lazy(() => import("@/pages/super-admin/IntegrationSupport"));
const SuperAdminAnalytics = React.lazy(() => import("@/pages/super-admin/Analytics"));

// Lazy-loaded tenant dashboard
const TenantDashboard = React.lazy(() => import("@/pages/tenant/Dashboard"));

// Route modules
import { settingsRoutes } from "@/routes/settingsRoutes";
import { accountingRoutes } from "@/routes/accountingRoutes";
import { crmRoutes } from "@/routes/crmRoutes";
import { salesRoutes } from "@/routes/salesRoutes";
import { inventoryRoutes } from "@/routes/inventoryRoutes";
import { hrRoutes } from "@/routes/hrRoutes";
import {
  purchasingRoutes,
  productionRoutes,
  documentsRoutes,
  posRoutes,
  analyticsRoutes,
  miscRoutes,
} from "@/routes/otherRoutes";

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TenantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineBanner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Super Admin routes */}
              <Route path="/super-admin" element={<ProtectedRoute requireSuperAdmin><SuperAdminLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<SuperAdminDashboard />} />
                <Route path="tenants" element={<TenantManagement />} />
                <Route path="modules" element={<ModuleManagement />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="monitoring" element={<PlatformMonitoring />} />
                <Route path="integrations" element={<IntegrationSupport />} />
                <Route path="analytics" element={<SuperAdminAnalytics />} />
              </Route>

              {/* Tenant routes - modularized */}
              <Route path="/" element={<ProtectedRoute><TenantLayout /></ProtectedRoute>}>
                <Route path="dashboard" element={<ErrorBoundary><TenantDashboard /></ErrorBoundary>} />
                {settingsRoutes}
                {accountingRoutes}
                {crmRoutes}
                {salesRoutes}
                {inventoryRoutes}
                {hrRoutes}
                {purchasingRoutes}
                {productionRoutes}
                {documentsRoutes}
                {posRoutes}
                {analyticsRoutes}
                {miscRoutes}
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </TenantProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
