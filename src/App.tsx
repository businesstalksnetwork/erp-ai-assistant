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

// Lazy-loaded tenant pages
const TenantDashboard = React.lazy(() => import("@/pages/tenant/Dashboard"));
const TenantSettings = React.lazy(() => import("@/pages/tenant/Settings"));
const TenantUsers = React.lazy(() => import("@/pages/tenant/Users"));
const AuditLog = React.lazy(() => import("@/pages/tenant/AuditLog"));
const LegalEntities = React.lazy(() => import("@/pages/tenant/LegalEntities"));
const Locations = React.lazy(() => import("@/pages/tenant/Locations"));
const Warehouses = React.lazy(() => import("@/pages/tenant/Warehouses"));
const SalesChannels = React.lazy(() => import("@/pages/tenant/SalesChannels"));
const CostCenters = React.lazy(() => import("@/pages/tenant/CostCenters"));
const BankAccounts = React.lazy(() => import("@/pages/tenant/BankAccounts"));
const TenantIntegrations = React.lazy(() => import("@/pages/tenant/Integrations"));
const BusinessRules = React.lazy(() => import("@/pages/tenant/BusinessRules"));
const ChartOfAccounts = React.lazy(() => import("@/pages/tenant/ChartOfAccounts"));
const JournalEntries = React.lazy(() => import("@/pages/tenant/JournalEntries"));
const FiscalPeriods = React.lazy(() => import("@/pages/tenant/FiscalPeriods"));
const Invoices = React.lazy(() => import("@/pages/tenant/Invoices"));
const InvoiceForm = React.lazy(() => import("@/pages/tenant/InvoiceForm"));
const TaxRates = React.lazy(() => import("@/pages/tenant/TaxRates"));
const GeneralLedger = React.lazy(() => import("@/pages/tenant/GeneralLedger"));
const Reports = React.lazy(() => import("@/pages/tenant/Reports"));
const TrialBalance = React.lazy(() => import("@/pages/tenant/TrialBalance"));
const IncomeStatement = React.lazy(() => import("@/pages/tenant/IncomeStatement"));
const BalanceSheet = React.lazy(() => import("@/pages/tenant/BalanceSheet"));
const BilansUspeha = React.lazy(() => import("@/pages/tenant/BilansUspeha"));
const BilansStanja = React.lazy(() => import("@/pages/tenant/BilansStanja"));
const Partners = React.lazy(() => import("@/pages/tenant/Partners"));
const Leads = React.lazy(() => import("@/pages/tenant/Leads"));
const Opportunities = React.lazy(() => import("@/pages/tenant/Opportunities"));
const OpportunityDetail = React.lazy(() => import("@/pages/tenant/OpportunityDetail"));
const Quotes = React.lazy(() => import("@/pages/tenant/Quotes"));
const SalesOrders = React.lazy(() => import("@/pages/tenant/SalesOrders"));
const PurchaseOrders = React.lazy(() => import("@/pages/tenant/PurchaseOrders"));
const GoodsReceipts = React.lazy(() => import("@/pages/tenant/GoodsReceipts"));
const SupplierInvoices = React.lazy(() => import("@/pages/tenant/SupplierInvoices"));
const Products = React.lazy(() => import("@/pages/tenant/Products"));
const ProductDetail = React.lazy(() => import("@/pages/tenant/ProductDetail"));
const InventoryStock = React.lazy(() => import("@/pages/tenant/InventoryStock"));
const InventoryMovements = React.lazy(() => import("@/pages/tenant/InventoryMovements"));
const Employees = React.lazy(() => import("@/pages/tenant/Employees"));
const EmployeeDetail = React.lazy(() => import("@/pages/tenant/EmployeeDetail"));
const EmployeeContracts = React.lazy(() => import("@/pages/tenant/EmployeeContracts"));
const Departments = React.lazy(() => import("@/pages/tenant/Departments"));
const Attendance = React.lazy(() => import("@/pages/tenant/Attendance"));
const LeaveRequests = React.lazy(() => import("@/pages/tenant/LeaveRequests"));
const Payroll = React.lazy(() => import("@/pages/tenant/Payroll"));
const BomTemplates = React.lazy(() => import("@/pages/tenant/BomTemplates"));
const ProductionOrders = React.lazy(() => import("@/pages/tenant/ProductionOrders"));
const ProductionOrderDetail = React.lazy(() => import("@/pages/tenant/ProductionOrderDetail"));
const Documents = React.lazy(() => import("@/pages/tenant/Documents"));
const DocumentDetail = React.lazy(() => import("@/pages/tenant/DocumentDetail"));
const ArchiveBook = React.lazy(() => import("@/pages/tenant/ArchiveBook"));
const Archiving = React.lazy(() => import("@/pages/tenant/Archiving"));
const DmsProjects = React.lazy(() => import("@/pages/tenant/DmsProjects"));
const DmsProjectDetail = React.lazy(() => import("@/pages/tenant/DmsProjectDetail"));
const DocumentBrowser = React.lazy(() => import("@/pages/tenant/DocumentBrowser"));
const DmsReports = React.lazy(() => import("@/pages/tenant/DmsReports"));
const DmsSettings = React.lazy(() => import("@/pages/tenant/DmsSettings"));
const PosTerminal = React.lazy(() => import("@/pages/tenant/PosTerminal"));
const PosSessions = React.lazy(() => import("@/pages/tenant/PosSessions"));
const EventMonitor = React.lazy(() => import("@/pages/tenant/EventMonitor"));
const Returns = React.lazy(() => import("@/pages/tenant/Returns"));
const FixedAssets = React.lazy(() => import("@/pages/tenant/FixedAssets"));
const AgingReports = React.lazy(() => import("@/pages/tenant/AgingReports"));
const Deferrals = React.lazy(() => import("@/pages/tenant/Deferrals"));
const Loans = React.lazy(() => import("@/pages/tenant/Loans"));
const ApprovalWorkflows = React.lazy(() => import("@/pages/tenant/ApprovalWorkflows"));
const PendingApprovals = React.lazy(() => import("@/pages/tenant/PendingApprovals"));
const Currencies = React.lazy(() => import("@/pages/tenant/Currencies"));
const Profile = React.lazy(() => import("@/pages/tenant/Profile"));
const BankStatements = React.lazy(() => import("@/pages/tenant/BankStatements"));
const OpenItems = React.lazy(() => import("@/pages/tenant/OpenItems"));
const PdvPeriods = React.lazy(() => import("@/pages/tenant/PdvPeriods"));
const YearEndClosing = React.lazy(() => import("@/pages/tenant/YearEndClosing"));
const CrmDashboard = React.lazy(() => import("@/pages/tenant/CrmDashboard"));
const Companies = React.lazy(() => import("@/pages/tenant/Companies"));
const CompanyDetail = React.lazy(() => import("@/pages/tenant/CompanyDetail"));
const Contacts = React.lazy(() => import("@/pages/tenant/Contacts"));
const ContactDetail = React.lazy(() => import("@/pages/tenant/ContactDetail"));
const Meetings = React.lazy(() => import("@/pages/tenant/Meetings"));
const MeetingsCalendar = React.lazy(() => import("@/pages/tenant/MeetingsCalendar"));
const Eotpremnica = React.lazy(() => import("@/pages/tenant/Eotpremnica"));
const DispatchNoteDetail = React.lazy(() => import("@/pages/tenant/DispatchNoteDetail"));
const FxRevaluation = React.lazy(() => import("@/pages/tenant/FxRevaluation"));
const Kompenzacija = React.lazy(() => import("@/pages/tenant/Kompenzacija"));
const InventoryCostLayers = React.lazy(() => import("@/pages/tenant/InventoryCostLayers"));
const WorkLogs = React.lazy(() => import("@/pages/tenant/WorkLogs"));
const WorkLogsBulkEntry = React.lazy(() => import("@/pages/tenant/WorkLogsBulkEntry"));
const WorkLogsCalendar = React.lazy(() => import("@/pages/tenant/WorkLogsCalendar"));
const OvertimeHours = React.lazy(() => import("@/pages/tenant/OvertimeHours"));
const NightWork = React.lazy(() => import("@/pages/tenant/NightWork"));
const AnnualLeaveBalances = React.lazy(() => import("@/pages/tenant/AnnualLeaveBalances"));
const HolidaysPage = React.lazy(() => import("@/pages/tenant/Holidays"));
const Deductions = React.lazy(() => import("@/pages/tenant/Deductions"));
const Allowances = React.lazy(() => import("@/pages/tenant/Allowances"));
const ExternalWorkers = React.lazy(() => import("@/pages/tenant/ExternalWorkers"));
const EmployeeSalaries = React.lazy(() => import("@/pages/tenant/EmployeeSalaries"));
const InsuranceRecords = React.lazy(() => import("@/pages/tenant/InsuranceRecords"));
const PositionTemplates = React.lazy(() => import("@/pages/tenant/PositionTemplates"));
const HrReports = React.lazy(() => import("@/pages/tenant/HrReports"));
const EBolovanje = React.lazy(() => import("@/pages/tenant/EBolovanje"));
const Salespeople = React.lazy(() => import("@/pages/tenant/Salespeople"));
const SalesPerformance = React.lazy(() => import("@/pages/tenant/SalesPerformance"));
const RetailPrices = React.lazy(() => import("@/pages/tenant/RetailPrices"));
const WebSettings = React.lazy(() => import("@/pages/tenant/WebSettings"));
const WebPrices = React.lazy(() => import("@/pages/tenant/WebPrices"));
const FiscalDevices = React.lazy(() => import("@/pages/tenant/FiscalDevices"));
const PosDailyReport = React.lazy(() => import("@/pages/tenant/PosDailyReport"));
const InternalOrders = React.lazy(() => import("@/pages/tenant/InternalOrders"));
const InternalTransfers = React.lazy(() => import("@/pages/tenant/InternalTransfers"));
const InternalGoodsReceipts = React.lazy(() => import("@/pages/tenant/InternalGoodsReceipts"));
const WarehouseDetail = React.lazy(() => import("@/pages/tenant/WarehouseDetail"));
const LegacyImport = React.lazy(() => import("@/pages/tenant/LegacyImport"));
const Kalkulacija = React.lazy(() => import("@/pages/tenant/Kalkulacija"));
const Nivelacija = React.lazy(() => import("@/pages/tenant/Nivelacija"));
const WmsZones = React.lazy(() => import("@/pages/tenant/WmsZones"));
const WmsBinDetail = React.lazy(() => import("@/pages/tenant/WmsBinDetail"));
const WmsTasks = React.lazy(() => import("@/pages/tenant/WmsTasks"));
const WmsReceiving = React.lazy(() => import("@/pages/tenant/WmsReceiving"));
const WmsPicking = React.lazy(() => import("@/pages/tenant/WmsPicking"));
const WmsCycleCounts = React.lazy(() => import("@/pages/tenant/WmsCycleCounts"));
const WmsSlotting = React.lazy(() => import("@/pages/tenant/WmsSlotting"));
const PostingRules = React.lazy(() => import("@/pages/tenant/PostingRules"));
const AccountingArchitecture = React.lazy(() => import("@/pages/tenant/AccountingArchitecture"));
const AiPlanningDashboard = React.lazy(() => import("@/pages/tenant/AiPlanningDashboard"));
const AiPlanningSchedule = React.lazy(() => import("@/pages/tenant/AiPlanningSchedule"));
const AiBottleneckPrediction = React.lazy(() => import("@/pages/tenant/AiBottleneckPrediction"));
const AiCapacitySimulation = React.lazy(() => import("@/pages/tenant/AiCapacitySimulation"));
const AiPlanningCalendar = React.lazy(() => import("@/pages/tenant/AiPlanningCalendar"));
const WmsDashboard = React.lazy(() => import("@/pages/tenant/WmsDashboard"));
const AnalyticsDashboard = React.lazy(() => import("@/pages/tenant/AnalyticsDashboard"));
const FinancialRatios = React.lazy(() => import("@/pages/tenant/FinancialRatios"));
const ProfitabilityAnalysis = React.lazy(() => import("@/pages/tenant/ProfitabilityAnalysis"));
const CashFlowForecast = React.lazy(() => import("@/pages/tenant/CashFlowForecast"));
const BudgetVsActuals = React.lazy(() => import("@/pages/tenant/BudgetVsActuals"));
const BreakEvenAnalysis = React.lazy(() => import("@/pages/tenant/BreakEvenAnalysis"));
const BusinessPlanning = React.lazy(() => import("@/pages/tenant/BusinessPlanning"));
const Expenses = React.lazy(() => import("@/pages/tenant/Expenses"));
const WorkingCapitalStress = React.lazy(() => import("@/pages/tenant/WorkingCapitalStress"));
const CustomerRiskScoring = React.lazy(() => import("@/pages/tenant/CustomerRiskScoring"));
const SupplierDependency = React.lazy(() => import("@/pages/tenant/SupplierDependency"));
const MarginBridge = React.lazy(() => import("@/pages/tenant/MarginBridge"));
const PayrollBenchmark = React.lazy(() => import("@/pages/tenant/PayrollBenchmark"));
const VatCashTrap = React.lazy(() => import("@/pages/tenant/VatCashTrap"));
const InventoryHealth = React.lazy(() => import("@/pages/tenant/InventoryHealth"));
const EarlyWarningSystem = React.lazy(() => import("@/pages/tenant/EarlyWarningSystem"));
const PayrollParameters = React.lazy(() => import("@/pages/tenant/PayrollParameters"));
const AiAuditLog = React.lazy(() => import("@/pages/tenant/AiAuditLog"));
const CompanyCategoriesSettings = React.lazy(() => import("@/pages/tenant/CompanyCategoriesSettings"));
const OpportunityStagesSettings = React.lazy(() => import("@/pages/tenant/OpportunityStagesSettings"));
const DiscountApprovalRules = React.lazy(() => import("@/pages/tenant/DiscountApprovalRules"));

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

              {/* Tenant routes */}
              <Route path="/" element={<ProtectedRoute><TenantLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<TenantDashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<ProtectedRoute requiredModule="settings"><TenantSettings /></ProtectedRoute>} />
                <Route path="settings/users" element={<ProtectedRoute requiredModule="settings-users"><TenantUsers /></ProtectedRoute>} />
                <Route path="settings/audit-log" element={<ProtectedRoute requiredModule="settings-audit-log"><AuditLog /></ProtectedRoute>} />
                <Route path="settings/legal-entities" element={<ProtectedRoute requiredModule="settings"><LegalEntities /></ProtectedRoute>} />
                <Route path="settings/locations" element={<ProtectedRoute requiredModule="settings"><Locations /></ProtectedRoute>} />
                <Route path="settings/warehouses" element={<ProtectedRoute requiredModule="settings"><Warehouses /></ProtectedRoute>} />
                
                <Route path="settings/cost-centers" element={<ProtectedRoute requiredModule="settings"><CostCenters /></ProtectedRoute>} />
                <Route path="settings/bank-accounts" element={<ProtectedRoute requiredModule="settings"><BankAccounts /></ProtectedRoute>} />
                <Route path="settings/integrations" element={<ProtectedRoute requiredModule="settings-integrations"><TenantIntegrations /></ProtectedRoute>} />
                <Route path="settings/posting-rules" element={<ProtectedRoute requiredModule="settings-business-rules"><PostingRules /></ProtectedRoute>} />
                <Route path="settings/accounting-architecture" element={<ProtectedRoute requiredModule="settings"><AccountingArchitecture /></ProtectedRoute>} />
                <Route path="settings/business-rules" element={<ProtectedRoute requiredModule="settings-business-rules"><BusinessRules /></ProtectedRoute>} />
                <Route path="settings/legacy-import" element={<ProtectedRoute requiredModule="settings"><LegacyImport /></ProtectedRoute>} />
                <Route path="settings/payroll-parameters" element={<ProtectedRoute requiredModule="settings"><PayrollParameters /></ProtectedRoute>} />
                <Route path="settings/ai-audit-log" element={<ProtectedRoute requiredModule="settings"><AiAuditLog /></ProtectedRoute>} />
                <Route path="settings/partner-categories" element={<ProtectedRoute requiredModule="settings"><CompanyCategoriesSettings /></ProtectedRoute>} />
                <Route path="settings/opportunity-stages" element={<ProtectedRoute requiredModule="settings"><OpportunityStagesSettings /></ProtectedRoute>} />
                <Route path="settings/discount-rules" element={<ProtectedRoute requiredModule="settings-approvals"><DiscountApprovalRules /></ProtectedRoute>} />
                <Route path="accounting/chart-of-accounts" element={<ProtectedRoute requiredModule="accounting"><ChartOfAccounts /></ProtectedRoute>} />
                <Route path="accounting/journal" element={<ProtectedRoute requiredModule="accounting"><JournalEntries /></ProtectedRoute>} />
                <Route path="accounting/invoices" element={<ProtectedRoute requiredModule="accounting"><Invoices /></ProtectedRoute>} />
                <Route path="accounting/invoices/new" element={<ProtectedRoute requiredModule="accounting"><InvoiceForm /></ProtectedRoute>} />
                <Route path="accounting/invoices/:id" element={<ProtectedRoute requiredModule="accounting"><InvoiceForm /></ProtectedRoute>} />
                <Route path="accounting/fiscal-periods" element={<ProtectedRoute requiredModule="accounting"><FiscalPeriods /></ProtectedRoute>} />
                <Route path="accounting/ledger" element={<ProtectedRoute requiredModule="accounting"><GeneralLedger /></ProtectedRoute>} />
                <Route path="accounting/expenses" element={<ProtectedRoute requiredModule="accounting"><Expenses /></ProtectedRoute>} />
                <Route path="accounting/reports" element={<ProtectedRoute requiredModule="accounting"><Reports /></ProtectedRoute>} />
                <Route path="accounting/reports/trial-balance" element={<ProtectedRoute requiredModule="accounting"><TrialBalance /></ProtectedRoute>} />
                <Route path="accounting/reports/income-statement" element={<ProtectedRoute requiredModule="accounting"><IncomeStatement /></ProtectedRoute>} />
                <Route path="accounting/reports/balance-sheet" element={<ProtectedRoute requiredModule="accounting"><BalanceSheet /></ProtectedRoute>} />
                <Route path="accounting/reports/bilans-uspeha" element={<ProtectedRoute requiredModule="accounting"><BilansUspeha /></ProtectedRoute>} />
                <Route path="accounting/reports/bilans-stanja" element={<ProtectedRoute requiredModule="accounting"><BilansStanja /></ProtectedRoute>} />
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
                <Route path="crm/meetings/calendar" element={<ProtectedRoute requiredModule="crm"><MeetingsCalendar /></ProtectedRoute>} />
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
                <Route path="inventory/dispatch-notes/:id" element={<ProtectedRoute requiredModule="inventory"><DispatchNoteDetail /></ProtectedRoute>} />
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
                <Route path="production/ai-planning" element={<ProtectedRoute requiredModule="production"><AiPlanningDashboard /></ProtectedRoute>} />
                <Route path="production/ai-planning/schedule" element={<ProtectedRoute requiredModule="production"><AiPlanningSchedule /></ProtectedRoute>} />
                <Route path="production/ai-planning/bottlenecks" element={<ProtectedRoute requiredModule="production"><AiBottleneckPrediction /></ProtectedRoute>} />
                <Route path="production/ai-planning/scenarios" element={<ProtectedRoute requiredModule="production"><AiCapacitySimulation /></ProtectedRoute>} />
                <Route path="production/ai-planning/calendar" element={<ProtectedRoute requiredModule="production"><AiPlanningCalendar /></ProtectedRoute>} />
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
                <Route path="inventory/wms/dashboard" element={<ProtectedRoute requiredModule="inventory"><WmsDashboard /></ProtectedRoute>} />
                <Route path="inventory/wms/zones" element={<ProtectedRoute requiredModule="inventory"><WmsZones /></ProtectedRoute>} />
                <Route path="inventory/wms/bins/:id" element={<ProtectedRoute requiredModule="inventory"><WmsBinDetail /></ProtectedRoute>} />
                <Route path="inventory/wms/tasks" element={<ProtectedRoute requiredModule="inventory"><WmsTasks /></ProtectedRoute>} />
                <Route path="inventory/wms/receiving" element={<ProtectedRoute requiredModule="inventory"><WmsReceiving /></ProtectedRoute>} />
                <Route path="inventory/wms/picking" element={<ProtectedRoute requiredModule="inventory"><WmsPicking /></ProtectedRoute>} />
                <Route path="inventory/wms/cycle-counts" element={<ProtectedRoute requiredModule="inventory"><WmsCycleCounts /></ProtectedRoute>} />
                <Route path="inventory/wms/slotting" element={<ProtectedRoute requiredModule="inventory"><WmsSlotting /></ProtectedRoute>} />
                <Route path="analytics" element={<ProtectedRoute requiredModule="analytics"><AnalyticsDashboard /></ProtectedRoute>} />
                <Route path="analytics/ratios" element={<ProtectedRoute requiredModule="analytics"><FinancialRatios /></ProtectedRoute>} />
                <Route path="analytics/profitability" element={<ProtectedRoute requiredModule="analytics"><ProfitabilityAnalysis /></ProtectedRoute>} />
                <Route path="analytics/cashflow-forecast" element={<ProtectedRoute requiredModule="analytics"><CashFlowForecast /></ProtectedRoute>} />
                <Route path="analytics/budget" element={<ProtectedRoute requiredModule="analytics"><BudgetVsActuals /></ProtectedRoute>} />
                <Route path="analytics/break-even" element={<ProtectedRoute requiredModule="analytics"><BreakEvenAnalysis /></ProtectedRoute>} />
                <Route path="analytics/planning" element={<ProtectedRoute requiredModule="analytics"><BusinessPlanning /></ProtectedRoute>} />
                <Route path="analytics/working-capital" element={<ProtectedRoute requiredModule="analytics"><WorkingCapitalStress /></ProtectedRoute>} />
                <Route path="analytics/customer-risk" element={<ProtectedRoute requiredModule="analytics"><CustomerRiskScoring /></ProtectedRoute>} />
                <Route path="analytics/supplier-risk" element={<ProtectedRoute requiredModule="analytics"><SupplierDependency /></ProtectedRoute>} />
                <Route path="analytics/margin-bridge" element={<ProtectedRoute requiredModule="analytics"><MarginBridge /></ProtectedRoute>} />
                <Route path="analytics/payroll-benchmark" element={<ProtectedRoute requiredModule="analytics"><PayrollBenchmark /></ProtectedRoute>} />
                <Route path="analytics/vat-trap" element={<ProtectedRoute requiredModule="analytics"><VatCashTrap /></ProtectedRoute>} />
                <Route path="analytics/inventory-health" element={<ProtectedRoute requiredModule="analytics"><InventoryHealth /></ProtectedRoute>} />
                <Route path="analytics/early-warning" element={<ProtectedRoute requiredModule="analytics"><EarlyWarningSystem /></ProtectedRoute>} />
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
