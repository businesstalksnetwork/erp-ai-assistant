import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";

// Purchasing
const PurchasingHub = React.lazy(() => import("@/pages/tenant/PurchasingHub"));
const PurchaseOrders = React.lazy(() => import("@/pages/tenant/PurchaseOrders"));
const GoodsReceipts = React.lazy(() => import("@/pages/tenant/GoodsReceipts"));
const SupplierInvoices = React.lazy(() => import("@/pages/tenant/SupplierInvoices"));
const SupplierInvoiceForm = React.lazy(() => import("@/pages/tenant/SupplierInvoiceForm"));
const IncomingEfakture = React.lazy(() => import("@/pages/tenant/IncomingEfakture"));

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
const AiQualityPrediction = React.lazy(() => import("@/pages/tenant/AiQualityPrediction"));
const WorkCenters = React.lazy(() => import("@/pages/tenant/WorkCenters"));
const EquipmentList = React.lazy(() => import("@/pages/tenant/EquipmentList"));
const OeeDashboard = React.lazy(() => import("@/pages/tenant/OeeDashboard"));
const QcCheckpoints = React.lazy(() => import("@/pages/tenant/QcCheckpoints"));

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
const DocumentTemplates = React.lazy(() => import("@/pages/tenant/DocumentTemplates"));
const DocumentApprovals = React.lazy(() => import("@/pages/tenant/DocumentApprovals"));
const DocumentSearch = React.lazy(() => import("@/pages/tenant/DocumentSearch"));
const BusinessContractTemplates = React.lazy(() => import("@/pages/tenant/BusinessContractTemplates"));
const TaxCalendar = React.lazy(() => import("@/pages/tenant/TaxCalendar"));

// POS
const PosHub = React.lazy(() => import("@/pages/tenant/PosHub"));
const PosTerminal = React.lazy(() => import("@/pages/tenant/PosTerminal"));
const PosSessions = React.lazy(() => import("@/pages/tenant/PosSessions"));
const FiscalDevices = React.lazy(() => import("@/pages/tenant/FiscalDevices"));
const PosDailyReport = React.lazy(() => import("@/pages/tenant/PosDailyReport"));
const RestaurantTables = React.lazy(() => import("@/pages/tenant/RestaurantTables"));
const KitchenDisplay = React.lazy(() => import("@/pages/tenant/KitchenDisplay"));
const RestaurantReservations = React.lazy(() => import("@/pages/tenant/RestaurantReservations"));
const PosManagerOverride = React.lazy(() => import("@/pages/tenant/PosManagerOverride"));

// Returns — moved to inventoryRoutes.tsx

// Service
const ServiceOrders = React.lazy(() => import("@/pages/tenant/ServiceOrders"));
const ServiceOrderForm = React.lazy(() => import("@/pages/tenant/ServiceOrderForm"));
const ServiceOrderDetail = React.lazy(() => import("@/pages/tenant/ServiceOrderDetail"));
const ServiceDevices = React.lazy(() => import("@/pages/tenant/ServiceDevices"));
const ServiceDeviceDetail = React.lazy(() => import("@/pages/tenant/ServiceDeviceDetail"));
const ServiceWorkOrders = React.lazy(() => import("@/pages/tenant/ServiceWorkOrders"));
const ServiceDashboard = React.lazy(() => import("@/pages/tenant/ServiceDashboard"));
const ServiceContracts = React.lazy(() => import("@/pages/tenant/ServiceContracts"));

// Loyalty
const LoyaltyDashboard = React.lazy(() => import("@/pages/tenant/LoyaltyDashboard"));
const LoyaltyPrograms = React.lazy(() => import("@/pages/tenant/LoyaltyPrograms"));
const LoyaltyMembers = React.lazy(() => import("@/pages/tenant/LoyaltyMembers"));
const LoyaltyRewards = React.lazy(() => import("@/pages/tenant/LoyaltyRewards"));

// Analytics
const AnalyticsDashboard = React.lazy(() => import("@/pages/tenant/AnalyticsDashboard"));
const FinancialRatios = React.lazy(() => import("@/pages/tenant/FinancialRatios"));
const ProfitabilityAnalysis = React.lazy(() => import("@/pages/tenant/ProfitabilityAnalysis"));
const CashFlowForecast = React.lazy(() => import("@/pages/tenant/CashFlowForecast"));
const BudgetVsActuals = React.lazy(() => import("@/pages/tenant/BudgetVsActuals"));
const BreakEvenAnalysis = React.lazy(() => import("@/pages/tenant/BreakEvenAnalysis"));
const BusinessPlanning = React.lazy(() => import("@/pages/tenant/BusinessPlanning"));
const WorkingCapitalStress = React.lazy(() => import("@/pages/tenant/WorkingCapitalStress"));
const CustomerRiskScoring = React.lazy(() => import("@/pages/tenant/CustomerRiskScoring"));
const SupplierDependency = React.lazy(() => import("@/pages/tenant/SupplierDependency"));
const SupplierEvaluation = React.lazy(() => import("@/pages/tenant/SupplierEvaluation"));
const DemandForecasting = React.lazy(() => import("@/pages/tenant/DemandForecasting"));
const MarginBridge = React.lazy(() => import("@/pages/tenant/MarginBridge"));
const PayrollBenchmark = React.lazy(() => import("@/pages/tenant/PayrollBenchmark"));
const VatCashTrap = React.lazy(() => import("@/pages/tenant/VatCashTrap"));
const InventoryHealth = React.lazy(() => import("@/pages/tenant/InventoryHealth"));
const EarlyWarningSystem = React.lazy(() => import("@/pages/tenant/EarlyWarningSystem"));
const DataQualityDashboard = React.lazy(() => import("@/pages/tenant/DataQualityDashboard"));
const PivotAnalytics = React.lazy(() => import("@/pages/tenant/PivotAnalytics"));

// AI
const AiBriefing = React.lazy(() => import("@/pages/tenant/AiBriefing"));

// Profile
const Profile = React.lazy(() => import("@/pages/tenant/Profile"));

const B = PageErrorBoundary;

export const purchasingRoutes = (
  <>
    <Route path="purchasing" element={<ProtectedRoute requiredModule="purchasing"><B><PurchasingHub /></B></ProtectedRoute>} />
    <Route path="purchasing/orders" element={<ProtectedRoute requiredModule="purchasing"><B><PurchaseOrders /></B></ProtectedRoute>} />
    <Route path="purchasing/goods-receipts" element={<ProtectedRoute requiredModule="purchasing"><B><GoodsReceipts /></B></ProtectedRoute>} />
    <Route path="purchasing/supplier-invoices" element={<ProtectedRoute requiredModule="purchasing"><B><SupplierInvoices /></B></ProtectedRoute>} />
    <Route path="purchasing/supplier-invoices/new" element={<ProtectedRoute requiredModule="purchasing"><B><SupplierInvoiceForm /></B></ProtectedRoute>} />
    <Route path="purchasing/supplier-invoices/:id" element={<ProtectedRoute requiredModule="purchasing"><B><SupplierInvoiceForm /></B></ProtectedRoute>} />
    <Route path="purchasing/incoming-efakture" element={<ProtectedRoute requiredModule="purchasing"><B><IncomingEfakture /></B></ProtectedRoute>} />
  </>
);

export const productionRoutes = (
  <>
    <Route path="production" element={<ProtectedRoute requiredModule="production"><B><ProductionHub /></B></ProtectedRoute>} />
    <Route path="production/bom" element={<ProtectedRoute requiredModule="production"><B><BomTemplates /></B></ProtectedRoute>} />
    <Route path="production/orders" element={<ProtectedRoute requiredModule="production"><B><ProductionOrders /></B></ProtectedRoute>} />
    <Route path="production/orders/:id" element={<ProtectedRoute requiredModule="production"><B><ProductionOrderDetail /></B></ProtectedRoute>} />
    <Route path="production/kanban" element={<ProtectedRoute requiredModule="production"><B><ProductionKanban /></B></ProtectedRoute>} />
    <Route path="production/gantt" element={<ProtectedRoute requiredModule="production"><B><ProductionGantt /></B></ProtectedRoute>} />
    <Route path="production/quality" element={<ProtectedRoute requiredModule="production"><B><QualityControl /></B></ProtectedRoute>} />
    <Route path="production/cost-variance" element={<ProtectedRoute requiredModule="production"><B><CostVarianceAnalysis /></B></ProtectedRoute>} />
    <Route path="production/mrp" element={<ProtectedRoute requiredModule="production"><B><MrpEngine /></B></ProtectedRoute>} />
    <Route path="production/maintenance" element={<ProtectedRoute requiredModule="production"><B><ProductionMaintenance /></B></ProtectedRoute>} />
    <Route path="production/ai-planning" element={<ProtectedRoute requiredModule="production"><B><AiPlanningDashboard /></B></ProtectedRoute>} />
    <Route path="production/ai-planning/schedule" element={<ProtectedRoute requiredModule="production"><B><AiPlanningSchedule /></B></ProtectedRoute>} />
    <Route path="production/ai-planning/bottlenecks" element={<ProtectedRoute requiredModule="production"><B><AiBottleneckPrediction /></B></ProtectedRoute>} />
    <Route path="production/ai-planning/scenarios" element={<ProtectedRoute requiredModule="production"><B><AiCapacitySimulation /></B></ProtectedRoute>} />
    <Route path="production/ai-planning/calendar" element={<ProtectedRoute requiredModule="production"><B><AiPlanningCalendar /></B></ProtectedRoute>} />
    <Route path="production/ai-planning/quality-prediction" element={<ProtectedRoute requiredModule="production"><B><AiQualityPrediction /></B></ProtectedRoute>} />
    <Route path="production/work-centers" element={<ProtectedRoute requiredModule="production"><B><WorkCenters /></B></ProtectedRoute>} />
    <Route path="production/equipment" element={<ProtectedRoute requiredModule="production"><B><EquipmentList /></B></ProtectedRoute>} />
    <Route path="production/oee" element={<ProtectedRoute requiredModule="production"><B><OeeDashboard /></B></ProtectedRoute>} />
    <Route path="production/qc-checkpoints" element={<ProtectedRoute requiredModule="production"><B><QcCheckpoints /></B></ProtectedRoute>} />
  </>
);

export const driveRoutes = (
  <Route path="drive" element={<ProtectedRoute requiredModule="documents"><B><Drive /></B></ProtectedRoute>} />
);

export const documentsRoutes = (
  <>
    <Route path="documents" element={<ProtectedRoute requiredModule="documents"><B><Documents /></B></ProtectedRoute>} />
    <Route path="documents/:id" element={<ProtectedRoute requiredModule="documents"><B><DocumentDetail /></B></ProtectedRoute>} />
    <Route path="documents/archive-book" element={<ProtectedRoute requiredModule="documents"><B><ArchiveBook /></B></ProtectedRoute>} />
    <Route path="documents/archiving" element={<ProtectedRoute requiredModule="documents"><B><Archiving /></B></ProtectedRoute>} />
    <Route path="documents/projects" element={<ProtectedRoute requiredModule="documents"><B><DmsProjects /></B></ProtectedRoute>} />
    <Route path="documents/projects/:id" element={<ProtectedRoute requiredModule="documents"><B><DmsProjectDetail /></B></ProtectedRoute>} />
    <Route path="documents/browser" element={<ProtectedRoute requiredModule="documents"><B><DocumentBrowser /></B></ProtectedRoute>} />
    <Route path="documents/reports" element={<ProtectedRoute requiredModule="documents"><B><DmsReports /></B></ProtectedRoute>} />
    <Route path="documents/settings" element={<ProtectedRoute requiredModule="documents"><B><DmsSettings /></B></ProtectedRoute>} />
    <Route path="documents/templates" element={<ProtectedRoute requiredModule="documents"><B><DocumentTemplates /></B></ProtectedRoute>} />
    <Route path="documents/approvals" element={<ProtectedRoute requiredModule="documents"><B><DocumentApprovals /></B></ProtectedRoute>} />
    <Route path="documents/search" element={<ProtectedRoute requiredModule="documents"><B><DocumentSearch /></B></ProtectedRoute>} />
    <Route path="documents/business-contracts" element={<ProtectedRoute requiredModule="documents"><B><BusinessContractTemplates /></B></ProtectedRoute>} />
  </>
);

export const posRoutes = (
  <>
    <Route path="pos" element={<ProtectedRoute requiredModule="pos"><B><PosHub /></B></ProtectedRoute>} />
    <Route path="pos/terminal" element={<ProtectedRoute requiredModule="pos"><B><PosTerminal /></B></ProtectedRoute>} />
    <Route path="pos/sessions" element={<ProtectedRoute requiredModule="pos"><B><PosSessions /></B></ProtectedRoute>} />
    <Route path="pos/fiscal-devices" element={<ProtectedRoute requiredModule="pos"><B><FiscalDevices /></B></ProtectedRoute>} />
    <Route path="pos/daily-report" element={<ProtectedRoute requiredModule="pos"><B><PosDailyReport /></B></ProtectedRoute>} />
    <Route path="pos/tables" element={<ProtectedRoute requiredModule="pos"><B><RestaurantTables /></B></ProtectedRoute>} />
    <Route path="pos/kitchen" element={<ProtectedRoute requiredModule="pos"><B><KitchenDisplay /></B></ProtectedRoute>} />
    <Route path="pos/reservations" element={<ProtectedRoute requiredModule="pos"><B><RestaurantReservations /></B></ProtectedRoute>} />
    <Route path="pos/manager-overrides" element={<ProtectedRoute requiredModule="pos"><B><PosManagerOverride /></B></ProtectedRoute>} />
  </>
);

export const analyticsRoutes = (
  <>
    <Route path="analytics" element={<ProtectedRoute requiredModule="analytics"><B><AnalyticsDashboard /></B></ProtectedRoute>} />
    <Route path="analytics/ratios" element={<ProtectedRoute requiredModule="analytics"><B><FinancialRatios /></B></ProtectedRoute>} />
    <Route path="analytics/profitability" element={<ProtectedRoute requiredModule="analytics"><B><ProfitabilityAnalysis /></B></ProtectedRoute>} />
    <Route path="analytics/cashflow-forecast" element={<ProtectedRoute requiredModule="analytics"><B><CashFlowForecast /></B></ProtectedRoute>} />
    <Route path="analytics/budget" element={<ProtectedRoute requiredModule="analytics"><B><BudgetVsActuals /></B></ProtectedRoute>} />
    <Route path="analytics/break-even" element={<ProtectedRoute requiredModule="analytics"><B><BreakEvenAnalysis /></B></ProtectedRoute>} />
    <Route path="analytics/planning" element={<ProtectedRoute requiredModule="analytics"><B><BusinessPlanning /></B></ProtectedRoute>} />
    <Route path="analytics/working-capital" element={<ProtectedRoute requiredModule="analytics"><B><WorkingCapitalStress /></B></ProtectedRoute>} />
    <Route path="analytics/customer-risk" element={<ProtectedRoute requiredModule="analytics"><B><CustomerRiskScoring /></B></ProtectedRoute>} />
    <Route path="analytics/supplier-risk" element={<ProtectedRoute requiredModule="analytics"><B><SupplierDependency /></B></ProtectedRoute>} />
    <Route path="analytics/supplier-evaluation" element={<ProtectedRoute requiredModule="analytics"><B><SupplierEvaluation /></B></ProtectedRoute>} />
    <Route path="analytics/demand-forecast" element={<ProtectedRoute requiredModule="analytics"><B><DemandForecasting /></B></ProtectedRoute>} />
    <Route path="analytics/margin-bridge" element={<ProtectedRoute requiredModule="analytics"><B><MarginBridge /></B></ProtectedRoute>} />
    <Route path="analytics/payroll-benchmark" element={<ProtectedRoute requiredModule="analytics"><B><PayrollBenchmark /></B></ProtectedRoute>} />
    <Route path="analytics/vat-trap" element={<ProtectedRoute requiredModule="analytics"><B><VatCashTrap /></B></ProtectedRoute>} />
    <Route path="analytics/inventory-health" element={<ProtectedRoute requiredModule="analytics"><B><InventoryHealth /></B></ProtectedRoute>} />
    <Route path="analytics/early-warning" element={<ProtectedRoute requiredModule="analytics"><B><EarlyWarningSystem /></B></ProtectedRoute>} />
    <Route path="analytics/data-quality" element={<ProtectedRoute requiredModule="analytics"><B><DataQualityDashboard /></B></ProtectedRoute>} />
    <Route path="analytics/pivot" element={<ProtectedRoute requiredModule="analytics"><B><PivotAnalytics /></B></ProtectedRoute>} />
  </>
);

export const serviceRoutes = (
  <>
    <Route path="service/dashboard" element={<ProtectedRoute requiredModule="service"><B><ServiceDashboard /></B></ProtectedRoute>} />
    <Route path="service/orders" element={<ProtectedRoute requiredModule="service"><B><ServiceOrders /></B></ProtectedRoute>} />
    <Route path="service/orders/new" element={<ProtectedRoute requiredModule="service"><B><ServiceOrderForm /></B></ProtectedRoute>} />
    <Route path="service/orders/:id" element={<ProtectedRoute requiredModule="service"><B><ServiceOrderDetail /></B></ProtectedRoute>} />
    <Route path="service/devices" element={<ProtectedRoute requiredModule="service"><B><ServiceDevices /></B></ProtectedRoute>} />
    <Route path="service/devices/:id" element={<ProtectedRoute requiredModule="service"><B><ServiceDeviceDetail /></B></ProtectedRoute>} />
    <Route path="service/my-work-orders" element={<ProtectedRoute requiredModule="service"><B><ServiceWorkOrders /></B></ProtectedRoute>} />
    <Route path="service/contracts" element={<ProtectedRoute requiredModule="service"><B><ServiceContracts /></B></ProtectedRoute>} />
  </>
);

export const loyaltyRoutes = (
  <>
    <Route path="loyalty" element={<ProtectedRoute requiredModule="loyalty"><B><LoyaltyDashboard /></B></ProtectedRoute>} />
    <Route path="loyalty/programs" element={<ProtectedRoute requiredModule="loyalty"><B><LoyaltyPrograms /></B></ProtectedRoute>} />
    <Route path="loyalty/members" element={<ProtectedRoute requiredModule="loyalty"><B><LoyaltyMembers /></B></ProtectedRoute>} />
    <Route path="loyalty/rewards" element={<ProtectedRoute requiredModule="loyalty"><B><LoyaltyRewards /></B></ProtectedRoute>} />
  </>
);

export const miscRoutes = (
  <>
    <Route path="ai/briefing" element={<ProtectedRoute><B><AiBriefing /></B></ProtectedRoute>} />
    <Route path="ai/tax-calendar" element={<ProtectedRoute><B><TaxCalendar /></B></ProtectedRoute>} />
    <Route path="profile" element={<ProtectedRoute><B><Profile /></B></ProtectedRoute>} />
  </>
);
