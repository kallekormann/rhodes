import { test, expect } from "@playwright/test";
import {
  e2eEnabled,
  assertEditorContains,
  editorPlainText,
  goOffline,
  goOnline,
  openEditor,
} from "./helpers";

test.describe("B1 + formatting — offline bold survives", () => {
  test.skip(!e2eEnabled, "Set RHODES_E2E_DOC_ID or RHODES_E2E_DOC_URL");

  test("bold formatting survives offline reconnect", async ({ page }) => {
    await openEditor(page);
    const editor = page.locator(".tiptap-editor-body");
    await editor.click();

    await goOffline(page);
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.type("Format test ");
    await page.keyboard.press("Control+b");
    await page.keyboard.type("bold");
    await page.waitForTimeout(800);
    await assertEditorContains(page, "bold");

    await goOnline(page);
    await page.waitForTimeout(4000);

    const bold = editor.locator("strong, b");
    await expect(bold.first()).toBeVisible();
    const text = await editorPlainText(page);
    expect(text).toContain("bold");
  });
});
