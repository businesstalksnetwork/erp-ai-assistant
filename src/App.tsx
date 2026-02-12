import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

import SuperAdminLayout from "@/layouts/SuperAdminLayout";
import SuperAdminDashboard from "@/pages/super-admin/Dashboard";
import TenantManagement from "@/pages/super-admin/TenantManagement";
import ModuleManagement from "@/pages/super-admin/ModuleManagement";
import UserManagement from "@/pages/super-admin/UserManagement";
import PlatformMonitoring from "@/pages/super-admin/PlatformMonitoring";
import IntegrationSupport from "@/pages/super-admin/IntegrationSupport";

import TenantLayout from "@/layouts/TenantLayout";
import TenantDashboard from "@/pages/tenant/Dashboard";
import TenantSettings from "@/pages/tenant/Settings";
import TenantUsers from "@/pages/tenant/Users";
import AuditLog from "@/pages/tenant/AuditLog";
import LegalEntities from "@/pages/tenant/LegalEntities";
import Locations from "@/pages/tenant/Locations";
import Warehouses from "@/pages/tenant/Warehouses";
import SalesChannels from "@/pages/tenant/SalesChannels";
import CostCenters from "@/pages/tenant/CostCenters";
import BankAccounts from "@/pages/tenant/BankAccounts";
import TenantIntegrations from "@/pages/tenant/Integrations";
import BusinessRules from "@/pages/tenant/BusinessRules";
import ChartOfAccounts from "@/pages/tenant/ChartOfAccounts";
import JournalEntries from "@/pages/tenant/JournalEntries";
import FiscalPeriods from "@/pages/tenant/FiscalPeriods";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
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
              </Route>

              {/* Tenant routes */}
              <Route path="/" element={<ProtectedRoute><TenantLayout /></ProtectedRoute>}>
                <Route path="dashboard" element={<TenantDashboard />} />
                <Route path="settings" element={<TenantSettings />} />
                <Route path="settings/users" element={<TenantUsers />} />
                <Route path="settings/audit-log" element={<AuditLog />} />
                <Route path="settings/legal-entities" element={<LegalEntities />} />
                <Route path="settings/locations" element={<Locations />} />
                <Route path="settings/warehouses" element={<Warehouses />} />
                <Route path="settings/sales-channels" element={<SalesChannels />} />
                <Route path="settings/cost-centers" element={<CostCenters />} />
                <Route path="settings/bank-accounts" element={<BankAccounts />} />
                <Route path="settings/integrations" element={<TenantIntegrations />} />
                <Route path="settings/business-rules" element={<BusinessRules />} />
                <Route path="accounting/chart-of-accounts" element={<ChartOfAccounts />} />
                <Route path="accounting/journal" element={<JournalEntries />} />
                <Route path="accounting/fiscal-periods" element={<FiscalPeriods />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
