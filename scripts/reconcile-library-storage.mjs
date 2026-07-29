#!/usr/bin/env node
/**
 * 28.4 — Report library metadata vs storage.objects drift (ops).
 *
 * Usage:
 *   node scripts/reconcile-library-storage.mjs
 *   node scripts/reconcile-library-storage.mjs --workspace <uuid>
 *   node scripts/reconcile-library-storage.mjs --sources
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const workspaceArg = args.find((a) => a.startsWith("--workspace="));
const workspaceId = workspaceArg ? workspaceArg.split("=")[1] : null;
const showSources = args.includes("--sources");

async function loadEnvFile() {
  const envPath = path.join(rootDir, "docker/.env");
  const content = await readFile(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error("DATABASE_URL or POSTGRES_PASSWORD is required");
  }
  return `postgresql://postgres:${password}@localhost:5433/postgres`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

await loadEnvFile();
const client = new pg.Client({ connectionString: await getDatabaseUrl() });
await client.connect();

try {
  if (showSources) {
    const { rows } = await client.query(
      `select * from public.library_source_storage_drift($1::uuid)`,
      [workspaceId],
    );
    const drift = rows.filter((row) => row.status !== "ok");
    console.log(`Source drift rows: ${drift.length} / ${rows.length}`);
    for (const row of drift.slice(0, 50)) {
      console.log(
        `${row.status}\t${row.source_id}\tmetadata=${formatBytes(Number(row.metadata_bytes))}\tstorage=${formatBytes(Number(row.storage_bytes))}\t${row.file_path}`,
      );
    }
    if (drift.length > 50) {
      console.log(`… and ${drift.length - 50} more`);
    }
    process.exit(drift.length > 0 ? 1 : 0);
  }

  const { rows } = await client.query(
    `select * from public.library_storage_reconciliation($1::uuid)`,
    [workspaceId],
  );

  if (rows.length === 0) {
    console.log("No library storage data found.");
    process.exit(0);
  }

  let totalDrift = 0;
  console.log("workspace_id\tmetadata\tstorage\tdrift\tsources\tobjects");
  for (const row of rows) {
    const drift = Number(row.drift_bytes);
    totalDrift += Math.abs(drift);
    console.log(
      `${row.workspace_id}\t${formatBytes(Number(row.metadata_bytes))}\t${formatBytes(Number(row.storage_bytes))}\t${formatBytes(drift)}\t${row.source_count}\t${row.object_count}`,
    );
  }

  process.exit(totalDrift > 0 ? 1 : 0);
} finally {
  await client.end();
}
