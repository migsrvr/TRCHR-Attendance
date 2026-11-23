import { expect, test } from "@playwright/test";

import { expectStylesLoaded, watchPageErrors } from "./helpers";

test.describe("Auth and root navigation", () => {
  test("root landing renders dev fixture banner, styles, and navigation links", async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto("/");
    await expectStylesLoaded(page);

    await expect(page.getByRole("heading", { name: /Top Realty Intern Attendance/i })).toBeVisible();
    await expect(page.locator('[data-dev-banner="true"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "HR" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Intern home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Test QR codes" })).toBeVisible();

    errors.assertClean();
  });

  test("sign-in validates empty fields, handles invalid password, signs in as HR, and signs out cleanly", async ({
    page,
  }) => {
    const errors = watchPageErrors(page);
    await page.goto("/sign-in");
    await expectStylesLoaded(page);

    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#signin-error")).toContainText("Enter your email and password.");

    await page.getByLabel("Email").fill("hr@toprealty.ph");
    await page.getByLabel("Password", { exact: true }).fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#signin-error")).toContainText("don't match");

    await page.getByLabel("Password", { exact: true }).fill("valid-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/hr");
    await expect(page.getByRole("heading", { level: 1, name: "Overview", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

    errors.assertClean();
  });

  test("set-password shows expired link state and validates live password checklist", async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto("/set-password?token=expired");
    await expect(page.getByRole("heading", { name: /link has expired/i })).toBeVisible();

    await page.goto("/set-password?token=demo-intern");
    await expect(page.getByRole("heading", { name: /Welcome,/i })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("StrongPass2026!");
    await page.getByLabel("Type it again", { exact: true }).fill("StrongPass2026!");
    await page.getByRole("button", { name: /Save and continue/i }).click();
    await page.waitForURL("**/welcome/camera");

    errors.assertClean();
  });
});
