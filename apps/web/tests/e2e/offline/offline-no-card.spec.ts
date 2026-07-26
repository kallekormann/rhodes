import { test, expect } from "@playwright/test";
import { e2eEnabled, openEditor, waitForNoConflictFloat } from "./helpers";

test.describe("E1 — no conflict card while offline", () => {
  test.skip(!e2eEnabled, "Set RHODES_E2E_DOC_ID or RHODES_E2E_DOC_URL");

  test("does not show Sync conflict float during offline editing", async ({
    page,
    context,
  }) => {
    await openEditor(page);
    await context.setOffline(true);
    await page.locator(".tiptap-editor-body").click();
    await page.keyboard.type(" offline-only-edit");
    await page.waitForTimeout(500);
    await waitForNoConflictFloat(page);
    await expect(page.getByText("Checking for conflicts")).toHaveCount(0);
  });
});
