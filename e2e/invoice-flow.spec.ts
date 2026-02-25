import { test, expect } from "../playwright-fixture";

test.describe("Invoice Flow - Unauthenticated", () => {
  test("invoices page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/sales/invoices");
    await expect(page).toHaveURL(/\/login/);
  });

  test("new invoice page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/sales/invoices/new");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sales orders page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/sales/sales-orders");
    await expect(page).toHaveURL(/\/login/);
  });
});
