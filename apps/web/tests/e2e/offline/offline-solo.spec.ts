import { test, expect } from "@playwright/test";
import {
  e2eEnabled,
  assertEditorContains,
  editorPlainText,
  goOffline,
  goOnline,
  openEditor,
  typeInEditor,
  waitForNoConflictFloat,
} from "./helpers";

test.describe("B1/E1 — solo offline edit", () => {
  test.skip(!e2eEnabled, "Set RHODES_E2E_DOC_ID or RHODES_E2E_DOC_URL");

  test("offline edit survives reconnect without Mode C float", async ({ page }) => {
    await openEditor(page);
    const marker = ` offline-${Date.now()}`;

    await goOffline(page);
    await waitForNoConflictFloat(page);
    await typeInEditor(page, marker);
    await page.waitForTimeout(800);
    await assertEditorContains(page, marker.trim());

    await goOnline(page);
    await assertEditorContains(page, marker.trim());

    await waitForNoConflictFloat(page);
    const text = await editorPlainText(page);
    expect(text).toContain(marker.trim());
  });
});
