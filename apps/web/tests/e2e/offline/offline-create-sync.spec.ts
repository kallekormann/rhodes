import { test, expect } from "@playwright/test";
import {
  e2eEnabled,
  assertEditorContains,
  editorPlainText,
  fetchDocumentPlainViaApi,
  goOffline,
  goOnline,
  typeInEditor,
} from "./helpers";

test.describe("Offline create sync", () => {
  test.skip(!e2eEnabled, "Set RHODES_E2E_DOC_ID or RHODES_E2E_DOC_URL");

  test("offline create body syncs to server on reconnect", async ({ page }) => {
    const marker = `offline-create-${Date.now()}`;

    await page.goto("/app/documents", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".documents-view", { timeout: 60_000 });

    await goOffline(page);

    await page.getByRole("button", { name: /create/i }).first().click();
    await page.waitForURL(/\/app\/editor/, { timeout: 60_000 });
    await page.waitForSelector(".tiptap-editor-body", { timeout: 60_000 });

    await typeInEditor(page, marker);
    await page.waitForTimeout(1_500);

    const docUrl = page.url();
    const docId = new URL(docUrl).searchParams.get("doc");
    expect(docId).toBeTruthy();

    await page.goto("/app/documents", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await goOnline(page);
    await page.waitForSelector(".documents-sync-gate__overlay", {
      timeout: 5_000,
    }).catch(() => {
      /* gate may finish quickly */
    });
    await page.waitForSelector(".documents-sync-gate__overlay", {
      state: "detached",
      timeout: 60_000,
    }).catch(() => {
      /* no pending work */
    });

    const plain = await fetchDocumentPlainViaApi(page, docId!);
    expect(plain).toContain(marker);

    await page.goto(docUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tiptap-editor-body", { timeout: 60_000 });
    await assertEditorContains(page, marker);
    const text = await editorPlainText(page);
    expect(text).toContain(marker);
  });
});
