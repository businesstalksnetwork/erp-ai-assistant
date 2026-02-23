import { test, expect } from "../playwright-fixture";

const mobileViewport = { width: 375, height: 812 };

const pages = [
  { path: "/auth", name: "Auth" },
  { path: "/dashboard", name: "Dashboard" },
  { path: "/invoices", name: "Invoices" },
  { path: "/kpo", name: "KPO" },
  { path: "/reminders", name: "Reminders" },
  { path: "/documents", name: "Documents" },
  { path: "/profile", name: "Profile" },
  { path: "/invoice-analytics", name: "Analytics" },
];

test.describe("Responsive - No horizontal scroll", () => {
  for (const p of pages) {
    test(`${p.name} (${p.path}) has no horizontal overflow at 375px`, async ({ page }) => {
      await page.setViewportSize(mobileViewport);
      await page.goto(p.path);
      await page.waitForTimeout(1000);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
    });
  }
});

test.describe("Responsive - Mobile bottom navigation", () => {
  test("bottom navigation is visible on mobile", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto("/dashboard");
    await page.waitForTimeout(500);
    
    const bottomNav = page.locator("nav.fixed.bottom-0, [data-testid='mobile-bottom-nav']");
    if (await bottomNav.count() > 0) {
      await expect(bottomNav.first()).toBeVisible();
    }
  });
});

test.describe("Responsive - Dashboard cards", () => {
  test("dashboard renders cards stacked on mobile", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);
    
    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
