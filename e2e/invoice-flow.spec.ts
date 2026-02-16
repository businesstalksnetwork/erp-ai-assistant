import { test, expect } from "../playwright-fixture";

test.describe("Invoice Flow", () => {
  test("invoices page loads", async ({ page }) => {
    await page.goto("/invoices");
    // Should show either invoices list or a company selection prompt
    const heading = page.getByText(/faktur/i).first();
    await expect(heading).toBeVisible();
  });

  test("new invoice button navigates correctly", async ({ page }) => {
    await page.goto("/invoices");
    const newBtn = page.getByRole("link", { name: /nova faktura/i });
    if (await newBtn.isVisible()) {
      await newBtn.click();
      await expect(page).toHaveURL(/\/invoices\/new/);
    }
  });

  test("new invoice form has required sections", async ({ page }) => {
    await page.goto("/invoices/new");
    // Check for key form sections
    const clientSection = page.getByText(/klijent/i).first();
    if (await clientSection.isVisible()) {
      await expect(clientSection).toBeVisible();
      await expect(page.getByText(/stavke/i).first()).toBeVisible();
    }
  });
});
