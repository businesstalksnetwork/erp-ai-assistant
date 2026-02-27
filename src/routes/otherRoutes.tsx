import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Purchasing
const PurchasingHub = React.lazy(() => import("@/pages/tenant/PurchasingHub"));
const PurchaseOrders = React.lazy(() => import("@/pages/tenant/PurchaseOrders"));
const GoodsReceipts = React.lazy(() => import("@/pages/tenant/GoodsReceipts"));
const SupplierInvoices = React.lazy(() => import("@/pages/tenant/SupplierInvoices"));
const SupplierInvoiceForm = React.lazy(() => import("@/pages/tenant/SupplierInvoiceForm"));

// Production
const ProductionHub = React.lazy(() => import("@/pages/tenant/ProductionHub"));
const BomTemplates = React.lazy(() => import("@/pages/tenant/BomTemplates"));
const ProductionOrders = React.lazy(() => import("@/pages/tenant/ProductionOrders"));
const ProductionOrderDetail = React.lazy(() => import("@/pages/tenant/ProductionOrderDetail"));
const ProductionKanban = React.lazy(() => import("@/pages/tenant/ProductionKanban"));
const ProductionGantt = React.lazy(() => import("@/pages/tenant/ProductionGantt"));
const QualityControl = React.lazy(() => import("@/pages/tenant/QualityControl"));
const CostVarianceAnalysis = React.lazy(() => import("@/pages/tenant/CostVarianceAnalysis"));
const MrpEngine = React.lazy(() => import("@/pages/tenant/MrpEngine"));
const ProductionMaintenance = React.lazy(() => import("@/pages/tenant/ProductionMaintenance"));
const AiPlanningDashboard = React.lazy(() => import("@/pages/tenant/AiPlanningDashboard"));
const AiPlanningSchedule = React.lazy(() => import("@/pages/tenant/AiPlanningSchedule"));
const AiBottleneckPrediction = React.lazy(() => import("@/pages/tenant/AiBottleneckPrediction"));
const AiCapacitySimulation = React.lazy(() => import("@/pages/tenant/AiCapacitySimulation"));
const AiPlanningCalendar = React.lazy(() => import("@/pages/tenant/AiPlanningCalendar"));

// Drive
const Drive = React.lazy(() => import("@/pages/tenant/Drive"));

// Documents
const Documents = React.lazy(() => import("@/pages/tenant/Documents"));
const DocumentDetail = React.lazy(() => import("@/pages/tenant/DocumentDetail"));
const ArchiveBook = React.lazy(() => import("@/pages/tenant/ArchiveBook"));
const Archiving = React.lazy(() => import("@/pages/tenant/Archiving"));
const DmsProjects = React.lazy(() => import("@/pages/tenant/DmsProjects"));
const DmsProjectDetail = React.lazy(() => import("@/pages/tenant/DmsProjectDetail"));
const DocumentBrowser = React.lazy(() => import("@/pages/tenant/DocumentBrowser"));
const DmsReports = React.lazy(() => import("@/pages/tenant/DmsReports"));
const DmsSettings = React.lazy(() => import("@/pages/tenant/DmsSettings"));

// POS
const PosHub = React.lazy(() => import("@/pages/tenant/PosHub"));
const PosTerminal = React.lazy(() => import("@/pages/tenant/PosTerminal"));
const PosSessions = React.lazy(() => import("@/pages/tenant/PosSessions"));
const FiscalDevices = React.lazy(() => import("@/pages/tenant/FiscalDevices"));
const PosDailyReport = React.lazy(() => import("@/pages/tenant/PosDailyReport"));

// Returns
const Returns = React.lazy(() => import("@/pages/tenant/Returns"));

// Analytics
const AnalyticsDashboard = React.lazy(() => import("@/pages/tenant/AnalyticsDashboard"));
const FinancialRatios = React.lazy(() => import("@/pages/tenant/FinancialRatios"));
const ProfitabilityAnalysis = React.lazy(() => import("@/pages/tenant/ProfitabilityAnalysis"));
const CashFlowForecast = React.lazy(() => import("@/pages/tenant/CashFlowForecast"));
const CashFlowStatement = React.lazy(() => import("@/pages/tenant/CashFlowStatement"));
const ComplianceDashboard = React.lazy(() => import("@/pages/tenant/ComplianceDashboard"));
const BudgetVsActuals = React.lazy(() => import("@/pages/tenant/BudgetVsActuals"));
const BreakEvenAnalysis = React.lazy(() => import("@/pages/tenant/BreakEvenAnalysis"));
const BusinessPlanning = React.lazy(() => import("@/pages/tenant/BusinessPlanning"));
const WorkingCapitalStress = React.lazy(() => import("@/pages/tenant/WorkingCapitalStress"));
const CustomerRiskScoring = React.lazy(() => import("@/pages/tenant/CustomerRiskScoring"));
const SupplierDependency = React.lazy(() => import("@/pages/tenant/SupplierDependency"));
const MarginBridge = React.lazy(() => import("@/pages/tenant/MarginBridge"));
const PayrollBenchmark = React.lazy(() => import("@/pages/tenant/PayrollBenchmark"));
const VatCashTrap = React.lazy(() => import("@/pages/tenant/VatCashTrap"));
const InventoryHealth = React.lazy(() => import("@/pages/tenant/InventoryHealth"));
const EarlyWarningSystem = React.lazy(() => import("@/pages/tenant/EarlyWarningSystem"));

// AI
const AiBriefing = React.lazy(() => import("@/pages/tenant/AiBriefing"));

// Profile
const Profile = React.lazy(() => import("@/pages/tenant/Profile"));

export const purchasingRoutes = (
  <>
    <Route path="purchasing" element={<ProtectedRoute requiredModule="purchasing"><PurchasingHub /></ProtectedRoute>} />
    <Route path="purchasing/orders" element={<ProtectedRoute requiredModule="purchasing"><PurchaseOrders /></ProtectedRoute>} />
    <Route path="purchasing/goods-receipts" element={<ProtectedRoute requiredModule="purchasing"><GoodsReceipts /></ProtectedRoute>} />
    <Route path="purchasing/supplier-invoices" element={<ProtectedRoute requiredModule="purchasing"><SupplierInvoices /></ProtectedRoute>} />
    <Route path="purchasing/supplier-invoices/new" element={<ProtectedRoute requiredModule="purchasing"><SupplierInvoiceForm /></ProtectedRoute>} />
    <Route path="purchasing/supplier-invoices/:id" element={<ProtectedRoute requiredModule="purchasing"><SupplierInvoiceForm /></ProtectedRoute>} />
  </>
);

export const productionRoutes = (
  <>
    <Route path="production" element={<ProtectedRoute requiredModule="production"><ProductionHub /></ProtectedRoute>} />
    <Route path="production/bom" element={<ProtectedRoute requiredModule="production"><BomTemplates /></ProtectedRoute>} />
    <Route path="production/orders" element={<ProtectedRoute requiredModule="production"><ProductionOrders /></ProtectedRoute>} />
    <Route path="production/orders/:id" element={<ProtectedRoute requiredModule="production"><ProductionOrderDetail /></ProtectedRoute>} />
    <Route path="production/kanban" element={<ProtectedRoute requiredModule="production"><ProductionKanban /></ProtectedRoute>} />
    <Route path="production/gantt" element={<ProtectedRoute requiredModule="production"><ProductionGantt /></ProtectedRoute>} />
    <Route path="production/quality" element={<ProtectedRoute requiredModule="production"><QualityControl /></ProtectedRoute>} />
    <Route path="production/cost-variance" element={<ProtectedRoute requiredModule="production"><CostVarianceAnalysis /></ProtectedRoute>} />
    <Route path="production/mrp" element={<ProtectedRoute requiredModule="production"><MrpEngine /></ProtectedRoute>} />
    <Route path="production/maintenance" element={<ProtectedRoute requiredModule="production"><ProductionMaintenance /></ProtectedRoute>} />
    <Route path="production/ai-planning" element={<ProtectedRoute requiredModule="production"><AiPlanningDashboard /></ProtectedRoute>} />
    <Route path="production/ai-planning/schedule" element={<ProtectedRoute requiredModule="production"><AiPlanningSchedule /></ProtectedRoute>} />
    <Route path="production/ai-planning/bottlenecks" element={<ProtectedRoute requiredModule="production"><AiBottleneckPrediction /></ProtectedRoute>} />
    <Route path="production/ai-planning/scenarios" element={<ProtectedRoute requiredModule="production"><AiCapacitySimulation /></ProtectedRoute>} />
    <Route path="production/ai-planning/calendar" element={<ProtectedRoute requiredModule="production"><AiPlanningCalendar /></ProtectedRoute>} />
  </>
);

export const driveRoutes = (
  <Route path="drive" element={<ProtectedRoute requiredModule="documents"><Drive /></ProtectedRoute>} />
);

export const documentsRoutes = (
  <>
    <Route path="documents" element={<ProtectedRoute requiredModule="documents"><Documents /></ProtectedRoute>} />
    <Route path="documents/:id" element={<ProtectedRoute requiredModule="documents"><DocumentDetail /></ProtectedRoute>} />
    <Route path="documents/archive-book" element={<ProtectedRoute requiredModule="documents"><ArchiveBook /></ProtectedRoute>} />
    <Route path="documents/archiving" element={<ProtectedRoute requiredModule="documents"><Archiving /></ProtectedRoute>} />
    <Route path="documents/projects" element={<ProtectedRoute requiredModule="documents"><DmsProjects /></ProtectedRoute>} />
    <Route path="documents/projects/:id" element={<ProtectedRoute requiredModule="documents"><DmsProjectDetail /></ProtectedRoute>} />
    <Route path="documents/browser" element={<ProtectedRoute requiredModule="documents"><DocumentBrowser /></ProtectedRoute>} />
    <Route path="documents/reports" element={<ProtectedRoute requiredModule="documents"><DmsReports /></ProtectedRoute>} />
    <Route path="documents/settings" element={<ProtectedRoute requiredModule="documents"><DmsSettings /></ProtectedRoute>} />
  </>
);

export const posRoutes = (
  <>
    <Route path="pos" element={<ProtectedRoute requiredModule="pos"><PosHub /></ProtectedRoute>} />
    <Route path="pos/terminal" element={<ProtectedRoute requiredModule="pos"><PosTerminal /></ProtectedRoute>} />
    <Route path="pos/sessions" element={<ProtectedRoute requiredModule="pos"><PosSessions /></ProtectedRoute>} />
    <Route path="pos/fiscal-devices" element={<ProtectedRoute requiredModule="pos"><FiscalDevices /></ProtectedRoute>} />
    <Route path="pos/daily-report" element={<ProtectedRoute requiredModule="pos"><PosDailyReport /></ProtectedRoute>} />
  </>
);

export const analyticsRoutes = (
  <>
    <Route path="analytics" element={<ProtectedRoute requiredModule="analytics"><AnalyticsDashboard /></ProtectedRoute>} />
    <Route path="analytics/ratios" element={<ProtectedRoute requiredModule="analytics"><FinancialRatios /></ProtectedRoute>} />
    <Route path="analytics/profitability" element={<ProtectedRoute requiredModule="analytics"><ProfitabilityAnalysis /></ProtectedRoute>} />
    <Route path="analytics/cashflow-forecast" element={<ProtectedRoute requiredModule="analytics"><CashFlowForecast /></ProtectedRoute>} />
    <Route path="accounting/cash-flow-statement" element={<ProtectedRoute requiredModule="accounting"><CashFlowStatement /></ProtectedRoute>} />
    <Route path="accounting/compliance" element={<ProtectedRoute requiredModule="accounting"><ComplianceDashboard /></ProtectedRoute>} />
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
  </>
);

export const miscRoutes = (
  <>
    <Route path="returns" element={<ProtectedRoute requiredModule="returns"><Returns /></ProtectedRoute>} />
    <Route path="ai/briefing" element={<AiBriefing />} />
    <Route path="profile" element={<Profile />} />
  </>
);
