export type TenantRole =
  | "admin" | "manager" | "accountant" | "sales" | "hr" | "store" | "user"
  | "finance_director" | "hr_manager" | "hr_staff"
  | "sales_manager" | "sales_rep"
  | "store_manager" | "cashier"
  | "warehouse_manager" | "warehouse_worker"
  | "production_manager" | "production_worker"
  | "viewer";

export type ModuleGroup =
  | "dashboard"
  | "crm"
  | "sales"
  | "web"
  | "purchasing"
  | "inventory"
  | "accounting"
  | "analytics"
  | "hr"
  | "production"
  | "documents"
  | "pos"
  | "returns"
  | "assets"
  | "service"
  | "settings"
  // Granular settings keys
  | "settings-users"
  | "settings-approvals"
  | "settings-business-rules"
  | "settings-tax-rates"
  | "settings-currencies"
  | "settings-audit-log"
  | "settings-events"
  | "settings-integrations"
  | "settings-role-permissions";

const ALL_MODULES: ModuleGroup[] = [
  "dashboard", "crm", "sales", "web", "purchasing", "inventory", "accounting", "analytics", "hr",
  "production", "documents", "pos", "returns", "assets", "service", "settings",
  "settings-users", "settings-approvals", "settings-business-rules",
  "settings-tax-rates", "settings-currencies", "settings-audit-log",
  "settings-events", "settings-integrations", "settings-role-permissions",
];

export const rolePermissions: Record<TenantRole, ModuleGroup[]> = {
  admin: ALL_MODULES,
  manager: [
    "dashboard", "crm", "sales", "web", "purchasing", "inventory", "returns",
    "production", "documents", "pos", "analytics", "assets", "service", "settings",
  ],
  finance_director: [
    "dashboard", "accounting", "analytics", "assets", "settings",
    "settings-tax-rates", "settings-currencies", "settings-audit-log",
  ],
  accountant: [
    "dashboard", "accounting", "analytics", "assets", "settings",
    "settings-tax-rates", "settings-currencies",
  ],
  hr_manager: ["dashboard", "hr", "documents", "analytics", "settings"],
  hr_staff: ["dashboard", "hr", "documents"],
  sales_manager: ["dashboard", "crm", "sales", "web", "inventory", "documents", "analytics"],
  sales_rep: ["dashboard", "crm", "sales", "web", "inventory", "documents"],
  sales: ["dashboard", "crm", "sales", "web", "inventory", "documents", "service"],
  hr: ["dashboard", "hr", "documents"],
  store_manager: ["dashboard", "crm", "sales", "inventory", "pos", "returns", "assets", "service", "analytics"],
  store: ["dashboard", "crm", "sales", "inventory", "pos", "returns", "assets", "service"],
  cashier: ["dashboard", "pos", "service"],
  warehouse_manager: ["dashboard", "inventory", "purchasing", "returns", "assets", "service"],
  warehouse_worker: ["dashboard", "inventory", "returns"],
  production_manager: ["dashboard", "production", "inventory", "documents", "service", "analytics"],
  production_worker: ["dashboard", "production", "inventory"],
  user: ["dashboard", "documents", "pos"],
  viewer: ["dashboard"],
};

/** Map route prefixes to module groups */
export const routeToModule: Record<string, ModuleGroup> = {
  "/dashboard": "dashboard",
  "/crm/": "crm",
  "/sales/": "sales",
  "/web/": "web",
  "/purchasing/": "purchasing",
  "/inventory/": "inventory",
  "/accounting/": "accounting",
  "/analytics": "analytics",
  "/hr/": "hr",
  "/production/": "production",
  "/documents": "documents",
  "/pos/": "pos",
  "/returns": "returns",
  "/settings/users": "settings-users",
  "/settings/approvals": "settings-approvals",
  "/settings/business-rules": "settings-business-rules",
  "/settings/tax-rates": "settings-tax-rates",
  "/settings/currencies": "settings-currencies",
  "/settings/audit-log": "settings-audit-log",
  "/settings/events": "settings-events",
  "/settings/integrations": "settings-integrations",
  "/settings/role-permissions": "settings-role-permissions",
  "/settings": "settings",
  "/assets/": "assets",
  "/service/": "service",
};
