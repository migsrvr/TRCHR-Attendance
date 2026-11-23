import { expect, type Page } from "@playwright/test";

export function watchPageErrors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  return {
    assertClean() {
      expect(pageErrors, `Uncaught page errors: ${pageErrors.join("; ")}`).toEqual([]);
      expect(consoleErrors, `Console errors: ${consoleErrors.join("; ")}`).toEqual([]);
    },
  };
}

export async function expectStylesLoaded(page: Page) {
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(248, 250, 252)");
}
