import { test, expect } from "../playwright-fixture";

test.describe("Authentication", () => {
  test("root redirects to login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login form is displayed", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /login|prijav/i })).toBeVisible();
  });

  test("register link is visible on login page", async ({ page }) => {
    await page.goto("/login");
    const registerLink = page.getByRole("link", { name: /registr|no.*account|nalog/i });
    await expect(registerLink).toBeVisible();
  });

  test("forgot password link is visible on login page", async ({ page }) => {
    await page.goto("/login");
    const resetLink = page.getByRole("link", { name: /forgot|zaborav|reset/i });
    await expect(resetLink).toBeVisible();
  });
});
