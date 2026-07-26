import { test, expect } from "@playwright/test";
import { e2eEnabled, editorUrl } from "./helpers";

test.describe("C1 — true conflict Mode C", () => {
  test.skip(
    !e2eEnabled || process.env.RHODES_E2E_CONFLICT !== "1",
    "Set RHODES_E2E_DOC_ID and RHODES_E2E_CONFLICT=1 with a two-user conflict fixture",
  );

  test("offline returner sees Mode C on overlapping edits", async ({
    browser,
  }) => {
    const docUrl = editorUrl();
    const contextA = await browser.newContext({
      storageState: "tests/e2e/.auth/user-a.json",
    });
    const contextB = await browser.newContext({
      storageState: "tests/e2e/.auth/user-b.json",
    });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(docUrl);
    await pageB.goto(docUrl);
    await pageA.waitForSelector(".tiptap-editor-body", { timeout: 60_000 });
    await pageB.waitForSelector(".tiptap-editor-body", { timeout: 60_000 });

    await contextA.setOffline(true);
    await pageA.locator(".tiptap-editor-body").click();
    await pageA.keyboard.press("Control+a");
    await pageA.keyboard.type("User A overlap text");

    await pageB.locator(".tiptap-editor-body").click();
    await pageB.keyboard.press("Control+a");
    await pageB.keyboard.type("User B overlap text");
    await pageB.waitForTimeout(1000);

    await contextA.setOffline(false);
    await pageA.waitForTimeout(5000);

    await expect(pageA.getByText("conflicting change", { exact: false })).toBeVisible();
    await expect(pageB.getByText("conflicting change", { exact: false })).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });
});
