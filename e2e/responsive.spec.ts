import { test, expect } from "../playwright-fixture";

const mobileViewport = { width: 375, height: 812 };

// Only public pages can be tested without auth; protected pages redirect to /login
const publicPages = [
  { path: "/login", name: "Login" },
  { path: "/register", name: "Register" },
  { path: "/reset-password", name: "Reset Password" },
];

test.describe("Responsive - No horizontal scroll on public pages", () => {
  for (const p of publicPages) {
    test(`${p.name} (${p.path}) has no horizontal overflow at 375px`, async ({ page }) => {
      await page.setViewportSize(mobileViewport);
      await page.goto(p.path);
      await page.waitForTimeout(1000);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  }
});

test.describe("Responsive - Protected pages redirect at mobile viewport", () => {
  const protectedPages = [
    { path: "/dashboard", name: "Dashboard" },
    { path: "/crm", name: "CRM" },
    { path: "/sales", name: "Sales" },
    { path: "/inventory", name: "Inventory" },
    { path: "/accounting", name: "Accounting" },
  ];

  for (const p of protectedPages) {
    test(`${p.name} redirects to /login at mobile viewport`, async ({ page }) => {
      await page.setViewportSize(mobileViewport);
      await page.goto(p.path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe("Responsive - Login page renders correctly on mobile", () => {
  test("login form is usable on mobile", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto("/login");
    await page.waitForTimeout(500);

    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
