import { test, expect } from "../playwright-fixture";

test.describe("Login Form Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("email field accepts input", async ({ page }) => {
    const emailInput = page.locator('input[id="email"]');
    await emailInput.fill("test@example.com");
    await expect(emailInput).toHaveValue("test@example.com");
  });

  test("password field accepts input", async ({ page }) => {
    const passwordInput = page.locator('input[id="password"]');
    await passwordInput.fill("mypassword123");
    await expect(passwordInput).toHaveValue("mypassword123");
  });

  test("forgot password link navigates to /reset-password", async ({ page }) => {
    const link = page.getByRole("link", { name: /forgot|zaborav|reset/i });
    await link.click();
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test("register link navigates to /register", async ({ page }) => {
    const link = page.getByRole("link", { name: /registr|no.*account|nalog/i });
    await link.click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("empty submit triggers HTML5 validation", async ({ page }) => {
    const submitBtn = page.getByRole("button", { name: /login|prijav/i });
    await submitBtn.click();
    // Email input should have required attribute and show validation
    const emailInput = page.locator('input[id="email"]');
    await expect(emailInput).toHaveAttribute("required", "");
    // Should still be on login page (form not submitted)
    await expect(page).toHaveURL(/\/login/);
  });
});
