export type TenantRole = "admin" | "manager" | "accountant" | "sales" | "hr" | "user";

export type ModuleGroup =
  | "dashboard"
  | "crm"
  | "sales"
  | "web"
  | "purchasing"
  | "inventory"
  | "accounting"
  | "hr"
  | "production"
  | "documents"
  | "pos"
  | "returns"
  | "settings"
  // Granular settings keys
  | "settings-users"
  | "settings-approvals"
  | "settings-business-rules"
  | "settings-tax-rates"
  | "settings-currencies"
  | "settings-audit-log"
  | "settings-events"
  | "settings-integrations";

const ALL_MODULES: ModuleGroup[] = [
  "dashboard", "crm", "sales", "web", "purchasing", "inventory", "accounting", "hr",
  "production", "documents", "pos", "returns", "settings",
  "settings-users", "settings-approvals", "settings-business-rules",
  "settings-tax-rates", "settings-currencies", "settings-audit-log",
  "settings-events", "settings-integrations",
];

export const rolePermissions: Record<TenantRole, ModuleGroup[]> = {
  admin: ALL_MODULES,
  manager: [
    "dashboard", "crm", "sales", "web", "purchasing", "inventory", "returns",
    "production", "documents", "pos", "settings",
  ],
  accountant: [
    "dashboard", "accounting", "settings",
    "settings-tax-rates", "settings-currencies",
  ],
  sales: ["dashboard", "crm", "sales", "web", "inventory", "documents"],
  hr: ["dashboard", "hr", "documents"],
  user: ["dashboard", "documents", "pos"],
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
  "/settings": "settings",
};
