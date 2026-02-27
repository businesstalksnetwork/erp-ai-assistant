import { useLocation, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

const routeLabels: Record<string, string> = {
  dashboard: "dashboard",
  crm: "crm",
  contacts: "contacts",
  companies: "companies",
  leads: "leads",
  opportunities: "opportunities",
  meetings: "meetings",
  partners: "partners",
  quotes: "quotes",
  "sales-orders": "salesOrders",
  accounting: "accounting",
  "chart-of-accounts": "chartOfAccounts",
  journal: "journalEntries",
  invoices: "invoices",
  "bank-statements": "bankStatements",
  "open-items": "openItems",
  pdv: "pdvPeriods",
  "fiscal-periods": "fiscalPeriods",
  "year-end": "yearEndClosing",
  ledger: "generalLedger",
  "fixed-assets": "fixedAssets",
  deferrals: "deferrals",
  loans: "loans",
  reports: "reports",
  inventory: "inventory",
  products: "products",
  stock: "stockOverview",
  movements: "movementHistory",
  hr: "hr",
  employees: "employees",
  contracts: "contracts",
  departments: "departments",
  attendance: "attendance",
  "leave-requests": "leaveRequests",
  "leave-policies": "leavePolicies",
  "leave-analytics": "leaveAnalytics",
  payroll: "payroll",
  production: "production",
  bom: "bomTemplates",
  orders: "productionOrders",
  purchasing: "purchasing",
  "goods-receipts": "goodsReceipts",
  "supplier-invoices": "supplierInvoices",
  documents: "documents",
  "archive-book": "dmsArchiveBook",
  archiving: "dmsArchiving",
  projects: "dmsProjects",
  browser: "dmsBrowser",
  pos: "pos",
  terminal: "posTerminal",
  sessions: "posSessions",
  settings: "settings",
  "tenant-profile": "tenantProfile",
  users: "users",
  "audit-log": "auditLog",
  "tax-rates": "taxRates",
  currencies: "currencies",
  approvals: "approvalWorkflows",
  events: "eventMonitor",
  integrations: "integrations",
  "business-rules": "businessRules",
  "legal-entities": "legalEntities",
  locations: "locations",
  warehouses: "warehouses",
  "sales-channels": "salesChannels",
  "cost-centers": "costCenters",
  "bank-accounts": "bankAccounts",
  returns: "returns",
  profile: "profile",
  new: "add",
  "posting-rules": "postingRules",
  "fx-revaluation": "fxRevaluation",
  kompenzacija: "kompenzacija",
  "cost-layers": "costLayers",
  "internal-orders": "internalOrders",
  "incoming-efakture": "incomingEfakture",
  "internal-transfers": "internalTransfers",
  "internal-receipts": "internalReceipts",
  kalkulacija: "kalkulacija",
  nivelacija: "nivelacija",
  "dispatch-notes": "dispatchNotes",
  wms: "inventory",
  zones: "wmsZones",
  tasks: "wmsTasks",
  receiving: "wmsReceiving",
  picking: "wmsPicking",
  "cycle-counts": "wmsCycleCounts",
  slotting: "wmsSlotting",
  "work-logs": "workLogs",
  overtime: "overtimeHours",
  "night-work": "nightWork",
  "annual-leave": "annualLeaveBalance",
  holidays: "holidays",
  deductions: "deductionsModule",
  allowances: "allowance",
  salaries: "salaryHistory",
  "external-workers": "externalWorkers",
  insurance: "insuranceRecords",
  "position-templates": "positionTemplates",
  ebolovanje: "eBolovanje",
  salespeople: "salespeople",
  "sales-performance": "salesPerformance",
  "retail-prices": "retailPrices",
  "fiscal-devices": "fiscalDevices",
  "daily-report": "dailyReport",
  "pending-approvals": "pendingApprovalsPage",
  sales: "salesModule",
  web: "webSales",
  bulk: "bulkEntry",
  calendar: "calendar",
  bins: "wmsBins",
  "ai-planning": "aiPlanning",
  "payroll-parameters": "payrollParamsTitle",
  "legacy-import": "legacyImport",
  "ai-audit-log": "aiAuditLog",
  "partner-categories": "companyCategories",
  "payroll-benchmark": "payrollBenchmark",
  "opportunity-stages": "opportunityStages",
  "discount-approval": "discountApprovalRules",
  schedule: "aiSchedule",
  bottlenecks: "bottleneckPrediction",
  scenarios: "capacitySimulation",
  "web-settings": "webSettings",
  "web-prices": "webPrices",
  "wms-dashboard": "wmsDashboard",
  assets: "assetsModule",
  registry: "assetsRegistry",
  categories: "assetsCategories",
  depreciation: "assetsDepreciation",
  disposals: "assetsDisposals",
  revaluations: "assetsRevalImpairment",
  assignments: "assetsAssignments",
  "inventory-count": "assetsInventoryCount",
  fleet: "fleetDashboard",
  vehicles: "fleetVehicles",
  fuel: "fleetFuel",
  service: "fleetService",
  registrations: "fleetRegistrations",
  leases: "leaseContracts",
  reverses: "reversDocuments",
  offboarding: "offboardingTitle",
  compliance: "complianceChecker",
  "cash-flow-statement": "cashFlowStatement",
  "statisticki-aneks": "statistickiAneks",
  "kpo-book": "kpoBook",
  "report-snapshots": "reportSnapshots",
  intercompany: "intercompanyTransactions",
  "transfer-pricing": "transferPricing",
  ios: "iosBalanceConfirmation",
  "credit-debit-notes": "creditDebitNotes",
  "proforma-invoices": "proformaInvoices",
  "recurring-invoices": "recurringInvoices",
  "recurring-journals": "recurringJournals",
  "invoice-register": "invoiceRegister",
  "document-import": "documentImport",
  "early-warning": "earlyWarningSystem",
  "vat-trap": "vatCashTrap",
  "supplier-risk": "supplierDependency",
  "customer-risk": "customerRiskScoring",
  "margin-bridge": "marginBridge",
  "inventory-health": "inventoryHealth",
  "working-capital": "workingCapitalStress",
  "break-even": "breakEvenAnalysis",
  planning: "businessPlanning",
  "non-employment-income": "nonEmploymentIncome",
  pppd: "pppdReview",
  kanban: "productionKanban",
  gantt: "productionGantt",
  quality: "qualityControl",
  "cost-variance": "costVarianceAnalysis",
  mrp: "mrpEngine",
  maintenance: "productionMaintenance",
  labor: "wmsLabor",
  "integration-health": "integrationHealth",
};

/**
 * Maps a route parent segment to the DB table + name column for UUID resolution.
 * Key = the segment BEFORE the UUID. Value = { table, nameCol }.
 */
const entityLookup: Record<string, { table: string; nameCol: string }> = {
  companies: { table: "companies", nameCol: "name" },
  contacts: { table: "contacts", nameCol: "first_name" },
  opportunities: { table: "opportunities", nameCol: "name" },
  employees: { table: "employees", nameCol: "first_name" },
  products: { table: "products", nameCol: "name" },
  invoices: { table: "invoices", nameCol: "invoice_number" },
  "supplier-invoices": { table: "supplier_invoices", nameCol: "invoice_number" },
  "sales-orders": { table: "sales_orders", nameCol: "order_number" },
  quotes: { table: "quotes", nameCol: "quote_number" },
  "dispatch-notes": { table: "dispatch_notes", nameCol: "dispatch_number" },
  orders: { table: "production_orders", nameCol: "order_number" },
  registry: { table: "assets", nameCol: "name" },
  vehicles: { table: "fleet_vehicles", nameCol: "plate_number" },
  leases: { table: "lease_contracts", nameCol: "contract_number" },
  "inventory-count": { table: "asset_inventory_counts", nameCol: "count_number" },
};

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}/.test(s);

function useEntityName(parentSegment: string, uuid: string | null) {
  const { tenantId } = useTenant();
  const lookup = uuid ? entityLookup[parentSegment] : null;

  return useQuery({
    queryKey: ["breadcrumb-entity", lookup?.table, uuid],
    queryFn: async () => {
      if (!lookup || !uuid) return null;
      const { data } = await supabase
        .from(lookup.table as any)
        .select(lookup.nameCol)
        .eq("id", uuid)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (!data) return null;
      const val = (data as any)[lookup.nameCol];
      // For contacts: combine first_name
      return val ? String(val) : null;
    },
    enabled: !!lookup && !!uuid && !!tenantId,
    staleTime: 1000 * 60 * 10,
  });
}

export function Breadcrumbs() {
  const location = useLocation();
  const { t } = useLanguage();
  const segments = location.pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on dashboard
  if (segments.length <= 1 && segments[0] === "dashboard") return null;

  // Find UUID segment and its parent for entity name resolution
  const uuidIdx = segments.findIndex(isUuid);
  const parentSegment = uuidIdx > 0 ? segments[uuidIdx - 1] : "";
  const uuidValue = uuidIdx >= 0 ? segments[uuidIdx] : null;

  const { data: entityName } = useEntityName(parentSegment, uuidValue);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/dashboard" className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, idx) => {
          const path = "/" + segments.slice(0, idx + 1).join("/");
          const isLast = idx === segments.length - 1;
          const labelKey = routeLabels[segment];

          let label: string;
          if (isUuid(segment)) {
            label = entityName || t("detail");
          } else {
            label = labelKey ? t(labelKey as any) : segment;
          }

          return (
            <span key={path} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={path}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
