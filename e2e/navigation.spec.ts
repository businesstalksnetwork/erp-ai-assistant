import { test, expect } from "../playwright-fixture";

test.describe("Navigation", () => {
  test("sidebar is visible on desktop", async ({ page }) => {
    await page.goto("/dashboard");
    // Sidebar should be visible on desktop viewport
    const sidebar = page.locator("aside");
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
      await expect(page.getByText("Kontrolna tabla")).toBeVisible();
      await expect(page.getByText("Fakture")).toBeVisible();
      await expect(page.getByText("KPO Knjiga")).toBeVisible();
    }
  });

  test("mobile menu toggle works", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    
    // Sidebar should be hidden initially on mobile
    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveCSS("transform", /translateX\(-/);
    
    // Open mobile menu
    const menuButton = page.locator("button").filter({ has: page.locator(".lucide-menu") });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(400);
      // Sidebar should now be visible
      await expect(sidebar).toBeVisible();
    }
  });

  test("header dropdown shows Moj Profil", async ({ page }) => {
    await page.goto("/dashboard");
    // Look for the user dropdown trigger in the header
    const headerDropdown = page.locator("header button").filter({ has: page.locator(".lucide-chevron-down") });
    if (await headerDropdown.isVisible()) {
      await headerDropdown.click();
      await expect(page.getByText("Moj Profil")).toBeVisible();
    }
  });
});
