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
import Invoices from "@/pages/tenant/Invoices";
import InvoiceForm from "@/pages/tenant/InvoiceForm";
import TaxRates from "@/pages/tenant/TaxRates";
import GeneralLedger from "@/pages/tenant/GeneralLedger";
import Reports from "@/pages/tenant/Reports";
import TrialBalance from "@/pages/tenant/TrialBalance";
import IncomeStatement from "@/pages/tenant/IncomeStatement";
import BalanceSheet from "@/pages/tenant/BalanceSheet";
import Partners from "@/pages/tenant/Partners";
import Leads from "@/pages/tenant/Leads";
import Opportunities from "@/pages/tenant/Opportunities";
import Quotes from "@/pages/tenant/Quotes";
import SalesOrders from "@/pages/tenant/SalesOrders";
import PurchaseOrders from "@/pages/tenant/PurchaseOrders";
import GoodsReceipts from "@/pages/tenant/GoodsReceipts";
import SupplierInvoices from "@/pages/tenant/SupplierInvoices";
import Products from "@/pages/tenant/Products";
import InventoryStock from "@/pages/tenant/InventoryStock";
import InventoryMovements from "@/pages/tenant/InventoryMovements";
import Employees from "@/pages/tenant/Employees";
import EmployeeContracts from "@/pages/tenant/EmployeeContracts";
import Departments from "@/pages/tenant/Departments";
import Attendance from "@/pages/tenant/Attendance";
import LeaveRequests from "@/pages/tenant/LeaveRequests";
import Payroll from "@/pages/tenant/Payroll";
import BomTemplates from "@/pages/tenant/BomTemplates";
import ProductionOrders from "@/pages/tenant/ProductionOrders";
import Documents from "@/pages/tenant/Documents";
import PosTerminal from "@/pages/tenant/PosTerminal";
import PosSessions from "@/pages/tenant/PosSessions";
import EventMonitor from "@/pages/tenant/EventMonitor";
import Returns from "@/pages/tenant/Returns";
import FixedAssets from "@/pages/tenant/FixedAssets";
import AgingReports from "@/pages/tenant/AgingReports";
import Deferrals from "@/pages/tenant/Deferrals";
import Loans from "@/pages/tenant/Loans";
import ApprovalWorkflows from "@/pages/tenant/ApprovalWorkflows";
import Currencies from "@/pages/tenant/Currencies";

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
                <Route path="accounting/invoices" element={<Invoices />} />
                <Route path="accounting/invoices/new" element={<InvoiceForm />} />
                <Route path="accounting/invoices/:id" element={<InvoiceForm />} />
                <Route path="accounting/fiscal-periods" element={<FiscalPeriods />} />
                <Route path="accounting/ledger" element={<GeneralLedger />} />
                <Route path="accounting/reports" element={<Reports />} />
                <Route path="accounting/reports/trial-balance" element={<TrialBalance />} />
                <Route path="accounting/reports/income-statement" element={<IncomeStatement />} />
                <Route path="accounting/reports/balance-sheet" element={<BalanceSheet />} />
                <Route path="settings/tax-rates" element={<TaxRates />} />
                <Route path="crm/partners" element={<Partners />} />
                <Route path="crm/leads" element={<Leads />} />
                <Route path="crm/opportunities" element={<Opportunities />} />
                <Route path="crm/quotes" element={<Quotes />} />
                <Route path="crm/sales-orders" element={<SalesOrders />} />
                <Route path="purchasing/orders" element={<PurchaseOrders />} />
                <Route path="purchasing/goods-receipts" element={<GoodsReceipts />} />
                <Route path="purchasing/supplier-invoices" element={<SupplierInvoices />} />
                <Route path="inventory/products" element={<Products />} />
                <Route path="inventory/stock" element={<InventoryStock />} />
                <Route path="inventory/movements" element={<InventoryMovements />} />
                <Route path="hr/employees" element={<Employees />} />
                <Route path="hr/contracts" element={<EmployeeContracts />} />
                <Route path="hr/departments" element={<Departments />} />
                <Route path="hr/attendance" element={<Attendance />} />
                <Route path="hr/leave-requests" element={<LeaveRequests />} />
                <Route path="hr/payroll" element={<Payroll />} />
                <Route path="production/bom" element={<BomTemplates />} />
                <Route path="production/orders" element={<ProductionOrders />} />
                <Route path="documents" element={<Documents />} />
                <Route path="pos/terminal" element={<PosTerminal />} />
                <Route path="pos/sessions" element={<PosSessions />} />
                <Route path="settings/events" element={<EventMonitor />} />
                <Route path="returns" element={<Returns />} />
                <Route path="accounting/fixed-assets" element={<FixedAssets />} />
                <Route path="accounting/reports/aging" element={<AgingReports />} />
                <Route path="accounting/deferrals" element={<Deferrals />} />
                <Route path="accounting/loans" element={<Loans />} />
                <Route path="settings/approvals" element={<ApprovalWorkflows />} />
                <Route path="settings/currencies" element={<Currencies />} />
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
