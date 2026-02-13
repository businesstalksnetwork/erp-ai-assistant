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
import OpportunityDetail from "@/pages/tenant/OpportunityDetail";
import Quotes from "@/pages/tenant/Quotes";
import SalesOrders from "@/pages/tenant/SalesOrders";
import PurchaseOrders from "@/pages/tenant/PurchaseOrders";
import GoodsReceipts from "@/pages/tenant/GoodsReceipts";
import SupplierInvoices from "@/pages/tenant/SupplierInvoices";
import Products from "@/pages/tenant/Products";
import ProductDetail from "@/pages/tenant/ProductDetail";
import InventoryStock from "@/pages/tenant/InventoryStock";
import InventoryMovements from "@/pages/tenant/InventoryMovements";
import Employees from "@/pages/tenant/Employees";
import EmployeeDetail from "@/pages/tenant/EmployeeDetail";
import EmployeeContracts from "@/pages/tenant/EmployeeContracts";
import Departments from "@/pages/tenant/Departments";
import Attendance from "@/pages/tenant/Attendance";
import LeaveRequests from "@/pages/tenant/LeaveRequests";
import Payroll from "@/pages/tenant/Payroll";
import BomTemplates from "@/pages/tenant/BomTemplates";
import ProductionOrders from "@/pages/tenant/ProductionOrders";
import ProductionOrderDetail from "@/pages/tenant/ProductionOrderDetail";
import Documents from "@/pages/tenant/Documents";
import DocumentDetail from "@/pages/tenant/DocumentDetail";
import ArchiveBook from "@/pages/tenant/ArchiveBook";
import Archiving from "@/pages/tenant/Archiving";
import DmsProjects from "@/pages/tenant/DmsProjects";
import DmsProjectDetail from "@/pages/tenant/DmsProjectDetail";
import DocumentBrowser from "@/pages/tenant/DocumentBrowser";
import DmsReports from "@/pages/tenant/DmsReports";
import DmsSettings from "@/pages/tenant/DmsSettings";
import PosTerminal from "@/pages/tenant/PosTerminal";
import PosSessions from "@/pages/tenant/PosSessions";
import EventMonitor from "@/pages/tenant/EventMonitor";
import Returns from "@/pages/tenant/Returns";
import FixedAssets from "@/pages/tenant/FixedAssets";
import AgingReports from "@/pages/tenant/AgingReports";
import Deferrals from "@/pages/tenant/Deferrals";
import Loans from "@/pages/tenant/Loans";
import ApprovalWorkflows from "@/pages/tenant/ApprovalWorkflows";
import PendingApprovals from "@/pages/tenant/PendingApprovals";
import Currencies from "@/pages/tenant/Currencies";
import Profile from "@/pages/tenant/Profile";
import BankStatements from "@/pages/tenant/BankStatements";
import OpenItems from "@/pages/tenant/OpenItems";
import PdvPeriods from "@/pages/tenant/PdvPeriods";
import YearEndClosing from "@/pages/tenant/YearEndClosing";
import CrmDashboard from "@/pages/tenant/CrmDashboard";
import Companies from "@/pages/tenant/Companies";
import CompanyDetail from "@/pages/tenant/CompanyDetail";
import Contacts from "@/pages/tenant/Contacts";
import ContactDetail from "@/pages/tenant/ContactDetail";
import Meetings from "@/pages/tenant/Meetings";
import Eotpremnica from "@/pages/tenant/Eotpremnica";
import FxRevaluation from "@/pages/tenant/FxRevaluation";
import Kompenzacija from "@/pages/tenant/Kompenzacija";
import InventoryCostLayers from "@/pages/tenant/InventoryCostLayers";
import WorkLogs from "@/pages/tenant/WorkLogs";
import WorkLogsBulkEntry from "@/pages/tenant/WorkLogsBulkEntry";
import WorkLogsCalendar from "@/pages/tenant/WorkLogsCalendar";
import OvertimeHours from "@/pages/tenant/OvertimeHours";
import NightWork from "@/pages/tenant/NightWork";
import AnnualLeaveBalances from "@/pages/tenant/AnnualLeaveBalances";
import HolidaysPage from "@/pages/tenant/Holidays";
import Deductions from "@/pages/tenant/Deductions";
import Allowances from "@/pages/tenant/Allowances";
import ExternalWorkers from "@/pages/tenant/ExternalWorkers";
import EmployeeSalaries from "@/pages/tenant/EmployeeSalaries";
import InsuranceRecords from "@/pages/tenant/InsuranceRecords";
import PositionTemplates from "@/pages/tenant/PositionTemplates";
import HrReports from "@/pages/tenant/HrReports";
import EBolovanje from "@/pages/tenant/EBolovanje";
import Salespeople from "@/pages/tenant/Salespeople";
import SalesPerformance from "@/pages/tenant/SalesPerformance";
import RetailPrices from "@/pages/tenant/RetailPrices";
import WebSettings from "@/pages/tenant/WebSettings";
import WebPrices from "@/pages/tenant/WebPrices";
import FiscalDevices from "@/pages/tenant/FiscalDevices";
import PosDailyReport from "@/pages/tenant/PosDailyReport";
import InternalOrders from "@/pages/tenant/InternalOrders";
import InternalTransfers from "@/pages/tenant/InternalTransfers";
import InternalGoodsReceipts from "@/pages/tenant/InternalGoodsReceipts";
import WarehouseDetail from "@/pages/tenant/WarehouseDetail";
import Kalkulacija from "@/pages/tenant/Kalkulacija";
import Nivelacija from "@/pages/tenant/Nivelacija";
import WmsZones from "@/pages/tenant/WmsZones";
import WmsBinDetail from "@/pages/tenant/WmsBinDetail";
import WmsTasks from "@/pages/tenant/WmsTasks";
import WmsReceiving from "@/pages/tenant/WmsReceiving";
import WmsPicking from "@/pages/tenant/WmsPicking";
import WmsCycleCounts from "@/pages/tenant/WmsCycleCounts";
import WmsSlotting from "@/pages/tenant/WmsSlotting";
import PostingRules from "@/pages/tenant/PostingRules";
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
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<TenantSettings />} />
                <Route path="settings/users" element={<ProtectedRoute requiredModule="settings-users"><TenantUsers /></ProtectedRoute>} />
                <Route path="settings/audit-log" element={<ProtectedRoute requiredModule="settings-audit-log"><AuditLog /></ProtectedRoute>} />
                <Route path="settings/legal-entities" element={<LegalEntities />} />
                <Route path="settings/locations" element={<Locations />} />
                <Route path="settings/warehouses" element={<Warehouses />} />
                
                <Route path="settings/cost-centers" element={<CostCenters />} />
                <Route path="settings/bank-accounts" element={<BankAccounts />} />
                <Route path="settings/integrations" element={<ProtectedRoute requiredModule="settings-integrations"><TenantIntegrations /></ProtectedRoute>} />
                <Route path="settings/posting-rules" element={<ProtectedRoute requiredModule="settings-business-rules"><PostingRules /></ProtectedRoute>} />
                <Route path="settings/business-rules" element={<ProtectedRoute requiredModule="settings-business-rules"><BusinessRules /></ProtectedRoute>} />
                <Route path="accounting/chart-of-accounts" element={<ProtectedRoute requiredModule="accounting"><ChartOfAccounts /></ProtectedRoute>} />
                <Route path="accounting/journal" element={<ProtectedRoute requiredModule="accounting"><JournalEntries /></ProtectedRoute>} />
                <Route path="accounting/invoices" element={<ProtectedRoute requiredModule="accounting"><Invoices /></ProtectedRoute>} />
                <Route path="accounting/invoices/new" element={<ProtectedRoute requiredModule="accounting"><InvoiceForm /></ProtectedRoute>} />
                <Route path="accounting/invoices/:id" element={<ProtectedRoute requiredModule="accounting"><InvoiceForm /></ProtectedRoute>} />
                <Route path="accounting/fiscal-periods" element={<ProtectedRoute requiredModule="accounting"><FiscalPeriods /></ProtectedRoute>} />
                <Route path="accounting/ledger" element={<ProtectedRoute requiredModule="accounting"><GeneralLedger /></ProtectedRoute>} />
                <Route path="accounting/reports" element={<ProtectedRoute requiredModule="accounting"><Reports /></ProtectedRoute>} />
                <Route path="accounting/reports/trial-balance" element={<ProtectedRoute requiredModule="accounting"><TrialBalance /></ProtectedRoute>} />
                <Route path="accounting/reports/income-statement" element={<ProtectedRoute requiredModule="accounting"><IncomeStatement /></ProtectedRoute>} />
                <Route path="accounting/reports/balance-sheet" element={<ProtectedRoute requiredModule="accounting"><BalanceSheet /></ProtectedRoute>} />
                <Route path="settings/tax-rates" element={<ProtectedRoute requiredModule="settings-tax-rates"><TaxRates /></ProtectedRoute>} />
                <Route path="crm" element={<ProtectedRoute requiredModule="crm"><CrmDashboard /></ProtectedRoute>} />
                <Route path="crm/partners" element={<ProtectedRoute requiredModule="crm"><Partners /></ProtectedRoute>} />
                <Route path="crm/companies" element={<ProtectedRoute requiredModule="crm"><Companies /></ProtectedRoute>} />
                <Route path="crm/companies/:id" element={<ProtectedRoute requiredModule="crm"><CompanyDetail /></ProtectedRoute>} />
                <Route path="crm/contacts" element={<ProtectedRoute requiredModule="crm"><Contacts /></ProtectedRoute>} />
                <Route path="crm/contacts/:id" element={<ProtectedRoute requiredModule="crm"><ContactDetail /></ProtectedRoute>} />
                <Route path="crm/leads" element={<ProtectedRoute requiredModule="crm"><Leads /></ProtectedRoute>} />
                <Route path="crm/opportunities" element={<ProtectedRoute requiredModule="crm"><Opportunities /></ProtectedRoute>} />
                <Route path="crm/opportunities/:id" element={<ProtectedRoute requiredModule="crm"><OpportunityDetail /></ProtectedRoute>} />
                <Route path="crm/meetings" element={<ProtectedRoute requiredModule="crm"><Meetings /></ProtectedRoute>} />
                <Route path="sales/quotes" element={<ProtectedRoute requiredModule="sales"><Quotes /></ProtectedRoute>} />
                <Route path="sales/sales-orders" element={<ProtectedRoute requiredModule="sales"><SalesOrders /></ProtectedRoute>} />
                <Route path="sales/sales-channels" element={<ProtectedRoute requiredModule="sales"><SalesChannels /></ProtectedRoute>} />
                <Route path="purchasing/orders" element={<ProtectedRoute requiredModule="purchasing"><PurchaseOrders /></ProtectedRoute>} />
                <Route path="purchasing/goods-receipts" element={<ProtectedRoute requiredModule="purchasing"><GoodsReceipts /></ProtectedRoute>} />
                <Route path="purchasing/supplier-invoices" element={<ProtectedRoute requiredModule="purchasing"><SupplierInvoices /></ProtectedRoute>} />
                <Route path="inventory/products" element={<ProtectedRoute requiredModule="inventory"><Products /></ProtectedRoute>} />
                <Route path="inventory/products/:id" element={<ProtectedRoute requiredModule="inventory"><ProductDetail /></ProtectedRoute>} />
                <Route path="inventory/stock" element={<ProtectedRoute requiredModule="inventory"><InventoryStock /></ProtectedRoute>} />
                <Route path="inventory/movements" element={<ProtectedRoute requiredModule="inventory"><InventoryMovements /></ProtectedRoute>} />
                <Route path="inventory/dispatch-notes" element={<ProtectedRoute requiredModule="inventory"><Eotpremnica /></ProtectedRoute>} />
                <Route path="hr/employees" element={<ProtectedRoute requiredModule="hr"><Employees /></ProtectedRoute>} />
                <Route path="hr/employees/:id" element={<ProtectedRoute requiredModule="hr"><EmployeeDetail /></ProtectedRoute>} />
                <Route path="hr/contracts" element={<ProtectedRoute requiredModule="hr"><EmployeeContracts /></ProtectedRoute>} />
                <Route path="hr/departments" element={<ProtectedRoute requiredModule="hr"><Departments /></ProtectedRoute>} />
                <Route path="hr/attendance" element={<ProtectedRoute requiredModule="hr"><Attendance /></ProtectedRoute>} />
                <Route path="hr/leave-requests" element={<ProtectedRoute requiredModule="hr"><LeaveRequests /></ProtectedRoute>} />
                <Route path="hr/payroll" element={<ProtectedRoute requiredModule="hr"><Payroll /></ProtectedRoute>} />
                <Route path="hr/work-logs" element={<ProtectedRoute requiredModule="hr"><WorkLogs /></ProtectedRoute>} />
                <Route path="hr/work-logs/bulk" element={<ProtectedRoute requiredModule="hr"><WorkLogsBulkEntry /></ProtectedRoute>} />
                <Route path="hr/work-logs/calendar" element={<ProtectedRoute requiredModule="hr"><WorkLogsCalendar /></ProtectedRoute>} />
                <Route path="hr/overtime" element={<ProtectedRoute requiredModule="hr"><OvertimeHours /></ProtectedRoute>} />
                <Route path="hr/night-work" element={<ProtectedRoute requiredModule="hr"><NightWork /></ProtectedRoute>} />
                <Route path="hr/annual-leave" element={<ProtectedRoute requiredModule="hr"><AnnualLeaveBalances /></ProtectedRoute>} />
                <Route path="hr/holidays" element={<ProtectedRoute requiredModule="hr"><HolidaysPage /></ProtectedRoute>} />
                <Route path="hr/deductions" element={<ProtectedRoute requiredModule="hr"><Deductions /></ProtectedRoute>} />
                <Route path="hr/allowances" element={<ProtectedRoute requiredModule="hr"><Allowances /></ProtectedRoute>} />
                <Route path="hr/external-workers" element={<ProtectedRoute requiredModule="hr"><ExternalWorkers /></ProtectedRoute>} />
                <Route path="hr/salaries" element={<ProtectedRoute requiredModule="hr"><EmployeeSalaries /></ProtectedRoute>} />
                <Route path="hr/insurance" element={<ProtectedRoute requiredModule="hr"><InsuranceRecords /></ProtectedRoute>} />
                <Route path="hr/position-templates" element={<ProtectedRoute requiredModule="hr"><PositionTemplates /></ProtectedRoute>} />
                <Route path="hr/reports" element={<ProtectedRoute requiredModule="hr"><HrReports /></ProtectedRoute>} />
                <Route path="hr/ebolovanje" element={<ProtectedRoute requiredModule="hr"><EBolovanje /></ProtectedRoute>} />
                <Route path="production/bom" element={<ProtectedRoute requiredModule="production"><BomTemplates /></ProtectedRoute>} />
                <Route path="production/orders" element={<ProtectedRoute requiredModule="production"><ProductionOrders /></ProtectedRoute>} />
                <Route path="production/orders/:id" element={<ProtectedRoute requiredModule="production"><ProductionOrderDetail /></ProtectedRoute>} />
                <Route path="documents" element={<ProtectedRoute requiredModule="documents"><Documents /></ProtectedRoute>} />
                <Route path="documents/:id" element={<ProtectedRoute requiredModule="documents"><DocumentDetail /></ProtectedRoute>} />
                <Route path="documents/archive-book" element={<ProtectedRoute requiredModule="documents"><ArchiveBook /></ProtectedRoute>} />
                <Route path="documents/archiving" element={<ProtectedRoute requiredModule="documents"><Archiving /></ProtectedRoute>} />
                <Route path="documents/projects" element={<ProtectedRoute requiredModule="documents"><DmsProjects /></ProtectedRoute>} />
                <Route path="documents/projects/:id" element={<ProtectedRoute requiredModule="documents"><DmsProjectDetail /></ProtectedRoute>} />
                <Route path="documents/browser" element={<ProtectedRoute requiredModule="documents"><DocumentBrowser /></ProtectedRoute>} />
                <Route path="documents/reports" element={<ProtectedRoute requiredModule="documents"><DmsReports /></ProtectedRoute>} />
                <Route path="documents/settings" element={<ProtectedRoute requiredModule="documents"><DmsSettings /></ProtectedRoute>} />
                <Route path="pos/terminal" element={<ProtectedRoute requiredModule="pos"><PosTerminal /></ProtectedRoute>} />
                <Route path="pos/sessions" element={<ProtectedRoute requiredModule="pos"><PosSessions /></ProtectedRoute>} />
                <Route path="pos/fiscal-devices" element={<ProtectedRoute requiredModule="pos"><FiscalDevices /></ProtectedRoute>} />
                <Route path="pos/daily-report" element={<ProtectedRoute requiredModule="pos"><PosDailyReport /></ProtectedRoute>} />
                <Route path="sales/salespeople" element={<ProtectedRoute requiredModule="sales"><Salespeople /></ProtectedRoute>} />
                <Route path="sales/sales-performance" element={<ProtectedRoute requiredModule="sales"><SalesPerformance /></ProtectedRoute>} />
                <Route path="sales/retail-prices" element={<ProtectedRoute requiredModule="sales"><RetailPrices /></ProtectedRoute>} />
                <Route path="web/settings" element={<ProtectedRoute requiredModule="web"><WebSettings /></ProtectedRoute>} />
                <Route path="web/prices" element={<ProtectedRoute requiredModule="web"><WebPrices /></ProtectedRoute>} />
                <Route path="settings/events" element={<ProtectedRoute requiredModule="settings-events"><EventMonitor /></ProtectedRoute>} />
                <Route path="returns" element={<ProtectedRoute requiredModule="returns"><Returns /></ProtectedRoute>} />
                <Route path="accounting/fixed-assets" element={<ProtectedRoute requiredModule="accounting"><FixedAssets /></ProtectedRoute>} />
                <Route path="accounting/reports/aging" element={<ProtectedRoute requiredModule="accounting"><AgingReports /></ProtectedRoute>} />
                <Route path="accounting/deferrals" element={<ProtectedRoute requiredModule="accounting"><Deferrals /></ProtectedRoute>} />
                <Route path="accounting/loans" element={<ProtectedRoute requiredModule="accounting"><Loans /></ProtectedRoute>} />
                <Route path="settings/approvals" element={<ProtectedRoute requiredModule="settings-approvals"><ApprovalWorkflows /></ProtectedRoute>} />
                <Route path="settings/pending-approvals" element={<ProtectedRoute requiredModule="settings-approvals"><PendingApprovals /></ProtectedRoute>} />
                <Route path="settings/currencies" element={<ProtectedRoute requiredModule="settings-currencies"><Currencies /></ProtectedRoute>} />
                <Route path="accounting/bank-statements" element={<ProtectedRoute requiredModule="accounting"><BankStatements /></ProtectedRoute>} />
                <Route path="accounting/open-items" element={<ProtectedRoute requiredModule="accounting"><OpenItems /></ProtectedRoute>} />
                <Route path="accounting/pdv" element={<ProtectedRoute requiredModule="accounting"><PdvPeriods /></ProtectedRoute>} />
                <Route path="accounting/year-end" element={<ProtectedRoute requiredModule="accounting"><YearEndClosing /></ProtectedRoute>} />
                <Route path="accounting/fx-revaluation" element={<ProtectedRoute requiredModule="accounting"><FxRevaluation /></ProtectedRoute>} />
                <Route path="accounting/kompenzacija" element={<ProtectedRoute requiredModule="accounting"><Kompenzacija /></ProtectedRoute>} />
                <Route path="inventory/cost-layers" element={<ProtectedRoute requiredModule="inventory"><InventoryCostLayers /></ProtectedRoute>} />
                <Route path="inventory/internal-orders" element={<ProtectedRoute requiredModule="inventory"><InternalOrders /></ProtectedRoute>} />
                <Route path="inventory/internal-transfers" element={<ProtectedRoute requiredModule="inventory"><InternalTransfers /></ProtectedRoute>} />
                <Route path="inventory/internal-receipts" element={<ProtectedRoute requiredModule="inventory"><InternalGoodsReceipts /></ProtectedRoute>} />
                <Route path="inventory/kalkulacija" element={<ProtectedRoute requiredModule="inventory"><Kalkulacija /></ProtectedRoute>} />
                <Route path="inventory/nivelacija" element={<ProtectedRoute requiredModule="inventory"><Nivelacija /></ProtectedRoute>} />
                <Route path="inventory/warehouses/:id" element={<ProtectedRoute requiredModule="inventory"><WarehouseDetail /></ProtectedRoute>} />
                <Route path="inventory/wms/zones" element={<ProtectedRoute requiredModule="inventory"><WmsZones /></ProtectedRoute>} />
                <Route path="inventory/wms/bins/:id" element={<ProtectedRoute requiredModule="inventory"><WmsBinDetail /></ProtectedRoute>} />
                <Route path="inventory/wms/tasks" element={<ProtectedRoute requiredModule="inventory"><WmsTasks /></ProtectedRoute>} />
                <Route path="inventory/wms/receiving" element={<ProtectedRoute requiredModule="inventory"><WmsReceiving /></ProtectedRoute>} />
                <Route path="inventory/wms/picking" element={<ProtectedRoute requiredModule="inventory"><WmsPicking /></ProtectedRoute>} />
                <Route path="inventory/wms/cycle-counts" element={<ProtectedRoute requiredModule="inventory"><WmsCycleCounts /></ProtectedRoute>} />
                <Route path="inventory/wms/slotting" element={<ProtectedRoute requiredModule="inventory"><WmsSlotting /></ProtectedRoute>} />
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
