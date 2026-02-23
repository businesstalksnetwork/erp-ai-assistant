import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const TenantSettings = React.lazy(() => import("@/pages/tenant/Settings"));
const TenantUsers = React.lazy(() => import("@/pages/tenant/Users"));
const AuditLog = React.lazy(() => import("@/pages/tenant/AuditLog"));
const LegalEntities = React.lazy(() => import("@/pages/tenant/LegalEntities"));
const Locations = React.lazy(() => import("@/pages/tenant/Locations"));
const Warehouses = React.lazy(() => import("@/pages/tenant/Warehouses"));
const CostCenters = React.lazy(() => import("@/pages/tenant/CostCenters"));
const BankAccounts = React.lazy(() => import("@/pages/tenant/BankAccounts"));
const TenantIntegrations = React.lazy(() => import("@/pages/tenant/Integrations"));
const PostingRules = React.lazy(() => import("@/pages/tenant/PostingRules"));
const AccountingArchitecture = React.lazy(() => import("@/pages/tenant/AccountingArchitecture"));
const BusinessRules = React.lazy(() => import("@/pages/tenant/BusinessRules"));
const LegacyImport = React.lazy(() => import("@/pages/tenant/LegacyImport"));
const PayrollParameters = React.lazy(() => import("@/pages/tenant/PayrollParameters"));
const AiAuditLog = React.lazy(() => import("@/pages/tenant/AiAuditLog"));
const CompanyCategoriesSettings = React.lazy(() => import("@/pages/tenant/CompanyCategoriesSettings"));
const OpportunityStagesSettings = React.lazy(() => import("@/pages/tenant/OpportunityStagesSettings"));
const DiscountApprovalRules = React.lazy(() => import("@/pages/tenant/DiscountApprovalRules"));
const TaxRates = React.lazy(() => import("@/pages/tenant/TaxRates"));
const ApprovalWorkflows = React.lazy(() => import("@/pages/tenant/ApprovalWorkflows"));
const PendingApprovals = React.lazy(() => import("@/pages/tenant/PendingApprovals"));
const Currencies = React.lazy(() => import("@/pages/tenant/Currencies"));
const EventMonitor = React.lazy(() => import("@/pages/tenant/EventMonitor"));

export const settingsRoutes = (
  <>
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
    <Route path="settings/tax-rates" element={<ProtectedRoute requiredModule="settings-tax-rates"><TaxRates /></ProtectedRoute>} />
    <Route path="settings/approvals" element={<ProtectedRoute requiredModule="settings-approvals"><ApprovalWorkflows /></ProtectedRoute>} />
    <Route path="settings/pending-approvals" element={<ProtectedRoute requiredModule="settings-approvals"><PendingApprovals /></ProtectedRoute>} />
    <Route path="settings/currencies" element={<ProtectedRoute requiredModule="settings-currencies"><Currencies /></ProtectedRoute>} />
    <Route path="settings/events" element={<ProtectedRoute requiredModule="settings-events"><EventMonitor /></ProtectedRoute>} />
  </>
);
