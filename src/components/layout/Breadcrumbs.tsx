import { useLocation, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
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
};

export function Breadcrumbs() {
  const location = useLocation();
  const { t } = useLanguage();
  const segments = location.pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on dashboard
  if (segments.length <= 1 && segments[0] === "dashboard") return null;

  // Skip UUID segments for display but keep in path
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}/.test(s);

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
          const label = isUuid(segment) ? t("detail") : (labelKey ? t(labelKey as any) : segment);

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
