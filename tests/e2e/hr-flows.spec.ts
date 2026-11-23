import { expect, test } from "@playwright/test";

import { expectStylesLoaded, watchPageErrors } from "./helpers";

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("HR desktop flows", () => {
  test("overview, interns add & edit, attendance filters, reviews decision & conflict, and reports render cleanly", async ({
    page,
  }) => {
    const errors = watchPageErrors(page);

    await page.goto("/hr");
    await expectStylesLoaded(page);
    await expect(page.getByRole("heading", { level: 1, name: "Overview", exact: true })).toBeVisible();

    // Interns directory + Add intern dialog
    await page.getByRole("link", { name: "Interns" }).click();
    await page.waitForURL("**/hr/interns");
    await page.getByRole("button", { name: "Add intern" }).click();
    const addInternDialog = page.locator("dialog[open]");
    await addInternDialog.getByLabel("Full name").fill("Paolo Santos");
    await addInternDialog.getByLabel("Email").fill("paolo.santos@school.edu.ph");
    await addInternDialog.getByLabel("Department").selectOption("Marketing");
    await addInternDialog.getByLabel("Start date").fill("2026-10-20");
    await addInternDialog.getByRole("button", { name: "Create and send link" }).click();
    await expect(addInternDialog.getByRole("status").filter({ hasText: "Paolo Santos" })).toBeVisible();
    await addInternDialog.getByRole("button", { name: "Done" }).click();

    // Intern profile + Edit internship dialog
    await page.goto("/hr/interns/ana-reyes");
    await page.getByRole("button", { name: "Edit internship" }).click();
    const editDialog = page.locator("dialog[open]");
    await editDialog.getByLabel("Required hours").fill("500");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog.getByRole("status").filter({ hasText: "Internship updated" })).toBeVisible();
    await editDialog.getByRole("button", { name: "Done" }).click();

    // Attendance records + session detail + date filters
    await page.goto("/hr/attendance");
    await expect(page.getByRole("heading", { level: 2, name: "Attendance records" })).toBeVisible();
    await expect(page.getByLabel("From date")).toBeVisible();
    await expect(page.getByLabel("To date")).toBeVisible();

    // Reviews queue, decision approval, and 409 conflict preview
    await page.goto("/hr/reviews/corr-oct15");
    await page.getByLabel(/Decision note/i).fill("Verified with marketing team lead.");
    await page.getByRole("button", { name: "Approve correction" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Approved." })).toBeVisible();

    await page.goto("/hr/reviews/corr-oct15?conflict=1");
    await expect(page.getByText(/This request changed while you were reading it/i)).toBeVisible();

    // DTR reports
    await page.goto("/hr/reports");
    await expect(page.getByRole("heading", { level: 1, name: "DTR reports" })).toBeVisible();

    errors.assertClean();
  });

  test("setup office, QR checkpoint add/rotate/revoke, policies, departments, HR team, and audit log work cleanly", async ({
    page,
  }) => {
    const errors = watchPageErrors(page);

    // Office & QR checkpoints
    await page.goto("/hr/setup");
    await expect(page.getByRole("heading", { level: 2, name: "Office and QR codes" })).toBeVisible();

    // Collapsible pin editor + save office
    await page.getByText("Edit pin coordinates and time zone").click();
    await expect(page.getByLabel("Pin latitude")).toBeVisible();
    await page.getByLabel("Accept radius", { exact: true }).fill("75");
    await page.getByRole("button", { name: "Save location" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved as settings v4" })).toBeVisible();

    // Add QR checkpoint
    await page.getByRole("button", { name: "Add checkpoint" }).click();
    const addCpDialog = page.locator("dialog[open]");
    await addCpDialog.getByLabel("Location label").fill("3rd floor reception");
    await addCpDialog.getByRole("button", { name: "Create checkpoint" }).click();
    await expect(addCpDialog.getByRole("status").filter({ hasText: "3rd floor reception" })).toBeVisible();
    await addCpDialog.getByRole("button", { name: "Done" }).click();

    // Rotate first active checkpoint & revoke second active checkpoint
    await page.getByRole("button", { name: "Rotate code" }).first().click();
    await page.locator("dialog[open]").getByRole("button", { name: "Rotate now" }).click();
    await expect(page.getByText(/v3 issued/i)).toBeVisible();

    await page.getByRole("button", { name: "Revoke" }).first().click();
    await page.locator("dialog[open]").getByRole("button", { name: "Revoke permanently" }).click();
    await expect(page.getByText(/Printed copies no longer scan/i)).toBeVisible();

    // Policies
    await page.goto("/hr/setup/policies");
    await expect(page.getByRole("heading", { level: 2, name: "Attendance policies" })).toBeVisible();

    // Departments add & deactivate
    await page.goto("/hr/setup/departments");
    await page.getByLabel("Name", { exact: true }).fill("Property Management");
    await page.getByRole("button", { name: "Add department" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Property Management added" })).toBeVisible();

    await page.getByRole("button", { name: "Deactivate" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByRole("status").filter({ hasText: "deactivated" })).toBeVisible();

    // HR Team management
    await page.goto("/hr/setup/team");
    await expect(page.getByRole("heading", { level: 1, name: "HR team" })).toBeVisible();
    await expect(page.locator('button[title="You cannot disable your own account"]')).toBeDisabled();

    await page.getByRole("button", { name: "Add HR user" }).click();
    const inviteDialog = page.locator("dialog[open]");
    await inviteDialog.getByLabel("Full name").fill("Elena Santos");
    await inviteDialog.getByLabel("Work email").fill("elena.santos@toprealty.ph");
    await inviteDialog.getByRole("button", { name: "Create and send link" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Invited Elena Santos" })).toBeVisible();
    await expect(page.getByText("elena.santos@toprealty.ph", { exact: true })).toBeVisible();

    // Audit log
    await page.goto("/hr/audit");
    await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();

    errors.assertClean();
  });
});
