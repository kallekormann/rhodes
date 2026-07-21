#!/usr/bin/env node
/**
 * Re-ingest all ready library sources so chunk_metadata + new extractors apply.
 *
 * Usage:
 *   node scripts/reindex-library-metadata.mjs
 *   node scripts/reindex-library-metadata.mjs --workspace=<uuid>
 *   node scripts/reindex-library-metadata.mjs --limit=20
 *   node scripts/reindex-library-metadata.mjs --concurrency=2
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Queue } from "bullmq";
import pg from "pg";

const LIBRARY_INGEST_QUEUE = "library-ingest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const workspaceArg = args.find((a) => a.startsWith("--workspace="));
const limitArg = args.find((a) => a.startsWith("--limit="));
const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
const workspaceId = workspaceArg?.split("=")[1] ?? null;
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;
const concurrency = Math.max(1, concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 2);

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

function redisConnection() {
  const redisUrl =
    process.env.REDIS_URL?.replace("redis://redis:", "redis://localhost:") ??
    "redis://localhost:6379";
  return { url: redisUrl, maxRetriesPerRequest: null };
}

async function addOrReplaceJob(queue, name, data, jobId, options = {}) {
  const existing = await queue.getJob(jobId);
  if (existing) {
    try {
      await existing.remove();
    } catch {
      return queue.add(name, data, {
        ...options,
        jobId: `${jobId}-${Date.now()}`,
      });
    }
  }
  return queue.add(name, data, { ...options, jobId });
}

async function main() {
  await loadEnvFile();

  const password = process.env.POSTGRES_PASSWORD;
  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://postgres:${password}@localhost:5433/postgres`;

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const params = [];
  let where = `embedding_status in ('ready', 'failed', 'pending')`;
  if (workspaceId) {
    params.push(workspaceId);
    where += ` and workspace_id = $${params.length}`;
  }

  let sql = `
    select id, workspace_id, file_path, file_type, file_name
    from library_sources
    where ${where}
    order by created_at asc
  `;
  if (limit != null && Number.isFinite(limit)) {
    params.push(limit);
    sql += ` limit $${params.length}`;
  }

  const { rows } = await client.query(sql, params);
  console.log(`Found ${rows.length} library source(s) to re-index (concurrency=${concurrency})`);

  const ingestQueue = new Queue(LIBRARY_INGEST_QUEUE, {
    connection: redisConnection(),
  });

  let enqueued = 0;
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (row) => {
        if (!row.file_type) {
          console.warn("skip (no file_type)", row.id);
          return;
        }

        await client.query(
          `update library_sources set embedding_status = 'pending' where id = $1`,
          [row.id],
        );

        await addOrReplaceJob(
          ingestQueue,
          "process-file",
          {
            sourceId: row.id,
            workspaceId: row.workspace_id,
            filePath: row.file_path,
            mimeType: row.file_type,
          },
          `ingest-${row.id}`,
          {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: { type: "exponential", delay: 5_000 },
          },
        );

        enqueued += 1;
        console.log("enqueued ingest", row.file_name ?? row.file_path);
      }),
    );
  }

  await ingestQueue.close();
  await client.end();
  console.log(`Enqueued ${enqueued} ingest job(s). Ensure the worker is running.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
