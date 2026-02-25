import { test, expect } from "../playwright-fixture";

const protectedRoutes = [
  // Dashboard
  "/dashboard",
  // Accounting
  "/accounting",
  "/accounting/chart-of-accounts",
  "/accounting/journal",
  "/accounting/general-ledger",
  "/accounting/trial-balance",
  "/accounting/bank-statements",
  // CRM
  "/crm",
  "/crm/partners",
  "/crm/companies",
  "/crm/contacts",
  "/crm/leads",
  "/crm/opportunities",
  "/crm/meetings",
  // Sales
  "/sales",
  "/sales/quotes",
  "/sales/sales-orders",
  "/sales/sales-channels",
  "/sales/salespeople",
  // Inventory
  "/inventory",
  "/inventory/products",
  "/inventory/stock",
  "/inventory/warehouses",
  "/inventory/stock-transfers",
  // HR
  "/hr",
  "/hr/employees",
  "/hr/payroll",
  "/hr/attendance",
  "/hr/leave-requests",
  // Purchasing
  "/purchasing",
  "/purchasing/orders",
  "/purchasing/supplier-invoices",
  // Production
  "/production",
  "/production/orders",
  "/production/bom",
  // POS
  "/pos",
  "/pos/terminal",
  // Analytics
  "/analytics",
  "/analytics/ratios",
  "/analytics/profitability",
  "/analytics/cashflow-forecast",
  // Documents & other
  "/documents",
  "/drive",
  "/returns",
  "/profile",
  // Settings
  "/settings",
  "/settings/users",
  "/settings/roles",
  // Super admin
  "/super-admin/dashboard",
];

test.describe("Route Protection - All protected routes redirect to /login", () => {
  for (const route of protectedRoutes) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
