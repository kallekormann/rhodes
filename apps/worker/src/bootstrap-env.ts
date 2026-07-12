import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(eq + 1);
    }
  }
}

function remapDockerHostnames() {
  if (process.env.REDIS_URL?.startsWith("redis://redis:")) {
    process.env.REDIS_URL = "redis://localhost:6379";
  }

  if (process.env.TIKA_URL?.includes("://tika:")) {
    process.env.TIKA_URL = "http://localhost:9998";
  }

  if (process.env.OLLAMA_HOST?.includes("://ollama:")) {
    process.env.OLLAMA_HOST = "http://localhost:11434";
  }

  process.env.SUPABASE_URL ??= "http://localhost:8000";

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
  }

  process.env.RHODES_DATA_DIR ??= path.join(rootDir, ".data");
  process.env.RHODES_LIBRARY_DATA_DIR ??= path.join(rootDir, ".data/library-files");
  process.env.RHODES_DOCUMENT_IMAGES_DATA_DIR ??= path.join(rootDir, ".data/document-images");
}

loadEnvFile(path.join(rootDir, "docker/.env"));
remapDockerHostnames();
