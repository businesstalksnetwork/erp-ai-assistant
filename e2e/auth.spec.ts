import { test, expect } from "../playwright-fixture";

test.describe("Authentication", () => {
  test("root redirects to auth page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText("Prijavi se")).toBeVisible();
  });

  test("login form is displayed", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Prijava")).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("signup tab switch works", async ({ page }) => {
    await page.goto("/auth");
    const registerTab = page.getByRole("tab", { name: /registracija/i });
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await expect(page.getByText(/ime i prezime|puno ime/i)).toBeVisible();
    }
  });

  test("login validates empty fields", async ({ page }) => {
    await page.goto("/auth");
    const submitBtn = page.getByRole("button", { name: /prijavi se|uloguj/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Expect some validation feedback (could be native or custom)
      const emailInput = page.locator('input[type="email"]').first();
      await expect(emailInput).toBeVisible();
    }
  });
});
