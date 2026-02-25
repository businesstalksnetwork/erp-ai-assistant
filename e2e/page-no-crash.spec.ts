import { test, expect } from "../playwright-fixture";

const publicPages = [
  { path: "/login", name: "Login" },
  { path: "/register", name: "Register" },
  { path: "/reset-password", name: "Reset Password" },
];

test.describe("Page Stability - No JS crashes on public pages", () => {
  for (const p of publicPages) {
    test(`${p.name} (${p.path}) loads without JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(p.path);
      await page.waitForTimeout(2000);

      // Page should have visible content (not blank)
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);

      // No uncaught JS errors
      const criticalErrors = errors.filter(
        (e) => !e.includes("ResizeObserver") && !e.includes("Non-Error promise rejection")
      );
      expect(criticalErrors).toHaveLength(0);

      // No chunk load failures
      const chunkErrors = errors.filter((e) => /chunk|loading.*module|dynamic import/i.test(e));
      expect(chunkErrors).toHaveLength(0);
    });
  }
});
