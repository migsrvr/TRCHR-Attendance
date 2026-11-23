import { expect, test } from "@playwright/test";

import { expectStylesLoaded, watchPageErrors } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Intern mobile flows", () => {
  test("dashboard, history, and tab bar stay cleanly inside 100dvh phone viewport", async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto("/dashboard");
    await expectStylesLoaded(page);

    await expect(page.getByText(/Top Realty/i).first()).toBeVisible();
    const tabNav = page.getByRole("navigation", { name: /Primary/i }).or(page.locator("nav").last());
    const box = await tabNav.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(845);

    await page.getByRole("link", { name: "History" }).click();
    await page.waitForURL("**/history");
    await expect(page.getByText(/October 2026/i)).toBeVisible();

    errors.assertClean();
  });

  test("corrections detail reply and replacement request flow work end-to-end", async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto("/corrections");
    await expect(page.getByRole("heading", { name: "Corrections" })).toBeVisible();

    await page.goto("/corrections/corr-oct15");
    await expect(page.getByLabel("Add details for HR")).toBeVisible();
    await page.getByLabel("Add details for HR").fill("Confirmed with marketing supervisor at lobby.");
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText("Confirmed with marketing supervisor at lobby.")).toBeVisible();

    await page.getByRole("link", { name: "Send a new request" }).click();
    await page.waitForURL("**/corrections/new?date=2026-10-15&replace=corr-oct15");
    await expect(page.getByText(/replaces your current open request/i)).toBeVisible();

    await page.getByLabel("Time out").fill("18:10");
    await page
      .getByLabel("Explain what happened")
      .fill("Left immediately after client call with supervisor Maria in Conference Room B.");
    await page.getByRole("button", { name: "Send to HR" }).click();
    await expect(page.getByRole("heading", { name: "Sent to HR" })).toBeVisible();

    errors.assertClean();
  });

  test("scan camera-off dev flow and /scan/test-codes page load cleanly", async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto("/scan/test-codes");
    await expect(page.getByRole("heading", { name: "Test QR codes" })).toBeVisible();

    await page.goto("/scan?camera=off");
    await expect(page.getByText(/Camera off \(developer mode\)/i)).toBeVisible();

    errors.assertClean();
  });
});
