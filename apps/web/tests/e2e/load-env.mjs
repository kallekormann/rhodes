import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(dir, ".env.e2e.local");
if (!fs.existsSync(envPath)) {
  console.warn(
    "tests/e2e/.env.e2e.local not found — copy .env.e2e.example and fill in credentials.",
  );
  process.exit(0);
}

for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
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
