import { test, expect } from "../playwright-fixture";

test.describe("Navigation - Unauthenticated Redirects", () => {
  test("dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("mobile viewport still redirects to login", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("settings page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
