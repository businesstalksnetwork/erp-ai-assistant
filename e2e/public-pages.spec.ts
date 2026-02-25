import { test, expect } from "../playwright-fixture";

test.describe("Public Pages", () => {
  test("login page renders form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /login|prijav/i })).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    await page.goto("/register");
    // Should show some form or registration content
    await expect(page.locator("body")).not.toBeEmpty();
    // Should not redirect to login (it's a public page)
    await expect(page).toHaveURL(/\/register/);
  });

  test("reset-password page renders", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test("root redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unknown route shows NotFound or redirects", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz");
    // Should either show a 404 page or redirect to login
    const url = page.url();
    const hasNotFound = await page.getByText(/not found|404|nije pronađ/i).isVisible().catch(() => false);
    const redirectedToLogin = /\/login/.test(url);
    expect(hasNotFound || redirectedToLogin).toBe(true);
  });
});
