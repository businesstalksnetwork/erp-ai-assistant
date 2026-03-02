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
const ReversSignaturePage = React.lazy(() => import("@/pages/tenant/ReversSignature"));
const DocumentSignPage = React.lazy(() => import("@/pages/tenant/DocumentSign"));

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
const AiGovernanceDashboard = React.lazy(() => import("@/pages/superadmin/AiGovernanceDashboard"));
const SystemHealth = React.lazy(() => import("@/pages/super-admin/SystemHealth"));

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
  driveRoutes,
  posRoutes,
  analyticsRoutes,
  serviceRoutes,
  loyaltyRoutes,
  complianceRoutes,
  miscRoutes,
} from "@/routes/otherRoutes";
import { assetsRoutes } from "@/routes/assetsRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

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
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/sign/:token" element={<React.Suspense fallback={<LoadingFallback />}><ReversSignaturePage /></React.Suspense>} />
              <Route path="/sign-document/:token" element={<React.Suspense fallback={<LoadingFallback />}><DocumentSignPage /></React.Suspense>} />

              {/* Super Admin routes */}
              <Route path="/super-admin" element={<ProtectedRoute requireSuperAdmin><SuperAdminLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<React.Suspense fallback={<LoadingFallback />}><SuperAdminDashboard /></React.Suspense>} />
                <Route path="tenants" element={<React.Suspense fallback={<LoadingFallback />}><TenantManagement /></React.Suspense>} />
                <Route path="modules" element={<React.Suspense fallback={<LoadingFallback />}><ModuleManagement /></React.Suspense>} />
                <Route path="users" element={<React.Suspense fallback={<LoadingFallback />}><UserManagement /></React.Suspense>} />
                <Route path="monitoring" element={<React.Suspense fallback={<LoadingFallback />}><PlatformMonitoring /></React.Suspense>} />
                <Route path="integrations" element={<React.Suspense fallback={<LoadingFallback />}><IntegrationSupport /></React.Suspense>} />
                <Route path="analytics" element={<React.Suspense fallback={<LoadingFallback />}><SuperAdminAnalytics /></React.Suspense>} />
                <Route path="ai-governance" element={<React.Suspense fallback={<LoadingFallback />}><AiGovernanceDashboard /></React.Suspense>} />
                <Route path="system-health" element={<React.Suspense fallback={<LoadingFallback />}><SystemHealth /></React.Suspense>} />
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
                {driveRoutes}
                {posRoutes}
                {analyticsRoutes}
                {assetsRoutes}
                {serviceRoutes}
                {loyaltyRoutes}
                {complianceRoutes}
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
