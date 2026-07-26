import { test, expect } from "@playwright/test";
import {
  e2eEnabled,
  assertEditorContains,
  editorUrl,
  fetchDocumentPlainViaApi,
  goOffline,
  goOnline,
  typeInEditor,
} from "./helpers";

test.describe("B2/E8 — peer sees offline merge", () => {
  test.skip(
    !e2eEnabled || !process.env.RHODES_E2E_DOC_ID,
    "Set RHODES_E2E_DOC_ID for two-context peer test",
  );

  test("online peer receives merged body after offline returner syncs", async ({
    browser,
  }) => {
    const docId = process.env.RHODES_E2E_DOC_ID!;
    const docUrl = editorUrl();
    const marker = ` peer-sync-${Date.now()}`;

    const contextA = await browser.newContext({
      storageState: "tests/e2e/.auth/user-a.json",
    });
    const contextB = await browser.newContext({
      storageState: "tests/e2e/.auth/user-b.json",
    });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(docUrl, { waitUntil: "domcontentloaded" });
    await pageB.goto(docUrl, { waitUntil: "domcontentloaded" });
    await pageA.waitForSelector(".tiptap-editor-body", { timeout: 60_000 });
    await pageB.waitForSelector(".tiptap-editor-body", { timeout: 60_000 });

    await goOffline(pageA);
    await typeInEditor(pageA, marker);
    await pageA.waitForTimeout(800);
    await assertEditorContains(pageA, marker.trim());

    await goOnline(pageA);
    await assertEditorContains(pageA, marker.trim());
    await expect
      .poll(() => fetchDocumentPlainViaApi(pageA, docId), { timeout: 25_000 })
      .toContain(marker.trim());

    await pageB.reload({ waitUntil: "domcontentloaded" });
    await pageB.waitForSelector(".tiptap-editor-body", { timeout: 60_000 });
    await assertEditorContains(pageB, marker.trim(), 25_000);

    await contextA.close();
    await contextB.close();
  });
});
