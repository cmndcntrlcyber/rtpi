import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/RTPI/);
  await expect(page.getByText("RTPI")).toBeVisible();
});

test("health check shows status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("System Status")).toBeVisible();
  await expect(page.getByText("Status:")).toBeVisible();
});
