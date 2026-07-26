import { expect, type Page } from "@playwright/test";

export const e2eEnabled = Boolean(
  process.env.RHODES_E2E_DOC_URL || process.env.RHODES_E2E_DOC_ID,
);

export function editorUrl(): string {
  if (process.env.RHODES_E2E_DOC_URL) {
    const url = process.env.RHODES_E2E_DOC_URL;
    return url.startsWith("http") ? new URL(url).pathname + new URL(url).search : url;
  }
  const docId = process.env.RHODES_E2E_DOC_ID;
  if (!docId) return "/app/documents";
  return `/app/editor?doc=${docId}`;
}

export async function openEditor(page: Page): Promise<void> {
  await page.goto(editorUrl(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".tiptap-editor-body", { timeout: 60_000 });
}

export async function editorPlainText(page: Page): Promise<string> {
  return page.locator(".tiptap-editor-body").innerText();
}

export async function typeInEditor(page: Page, text: string): Promise<void> {
  const editor = page.locator(".tiptap-editor-body");
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}

export async function assertEditorContains(
  page: Page,
  substring: string,
  timeoutMs = 15_000,
): Promise<void> {
  await expect
    .poll(async () => editorPlainText(page), { timeout: timeoutMs })
    .toContain(substring);
}

export async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
  await page.waitForFunction(() => !navigator.onLine);
}

export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
  await page.waitForFunction(() => navigator.onLine);
}

export async function waitForNoConflictFloat(page: Page): Promise<void> {
  await expect(page.getByText("Sync conflict", { exact: false })).toHaveCount(0);
}

export async function fetchDocumentPlainViaApi(
  page: Page,
  documentId: string,
): Promise<string> {
  const response = await page.request.get(`/app/api/documents/${documentId}`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const plain = data.document?.content_plain;
  return typeof plain === "string" ? plain.trim() : "";
}
