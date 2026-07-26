import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const authDir = path.join(process.cwd(), "tests/e2e/.auth");

function loadE2eEnv(): void {
  const envPath = path.join(process.cwd(), "tests/e2e/.env.e2e.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function loginAndSave(params: {
  baseURL: string;
  email: string;
  password: string;
  outFile: string;
}): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: params.baseURL });
  const page = await context.newPage();

  await page.goto("/app/auth/login", { waitUntil: "networkidle" });
  await page.waitForSelector('input[name="email"]', { timeout: 60_000 });
  await page.locator('input[name="email"]').fill(params.email);
  await page.locator('input[name="password"]').fill(params.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
    timeout: 60_000,
  });

  fs.mkdirSync(authDir, { recursive: true });
  await context.storageState({ path: params.outFile });
  await browser.close();
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  loadE2eEnv();

  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ??
    "http://127.0.0.1:3001";

  const userAEmail = process.env.RHODES_E2E_USER_A_EMAIL;
  const userAPassword = process.env.RHODES_E2E_USER_A_PASSWORD;
  const userBEmail = process.env.RHODES_E2E_USER_B_EMAIL;
  const userBPassword = process.env.RHODES_E2E_USER_B_PASSWORD;

  if (userAEmail && userAPassword) {
    await loginAndSave({
      baseURL,
      email: userAEmail,
      password: userAPassword,
      outFile: path.join(authDir, "user-a.json"),
    });
  }

  if (userBEmail && userBPassword) {
    await loginAndSave({
      baseURL,
      email: userBEmail,
      password: userBPassword,
      outFile: path.join(authDir, "user-b.json"),
    });
  }
}
