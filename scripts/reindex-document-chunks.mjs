#!/usr/bin/env node
/**
 * Re-chunk + re-embed workspace documents into document_chunks.
 *
 * Usage:
 *   node scripts/reindex-document-chunks.mjs
 *   node scripts/reindex-document-chunks.mjs --workspace=<uuid>
 *   node scripts/reindex-document-chunks.mjs --limit=50
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Queue } from "bullmq";
import pg from "pg";

const DOCUMENT_EMBED_QUEUE = "document-embed";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const workspaceArg = args.find((a) => a.startsWith("--workspace="));
const limitArg = args.find((a) => a.startsWith("--limit="));
const workspaceId = workspaceArg?.split("=")[1] ?? null;
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

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
  let where = `(
    coalesce(nullif(trim(content_plain), ''), '') <> ''
    or content is not null
  )`;
  if (workspaceId) {
    params.push(workspaceId);
    where += ` and workspace_id = $${params.length}`;
  }

  let sql = `
    select id, workspace_id, title
    from documents
    where ${where}
    order by updated_at desc nulls last, created_at desc
  `;
  if (limit != null && Number.isFinite(limit)) {
    params.push(limit);
    sql += ` limit $${params.length}`;
  }

  const { rows } = await client.query(sql, params);
  console.log(`Found ${rows.length} document(s) to re-chunk`);

  const embedQueue = new Queue(DOCUMENT_EMBED_QUEUE, {
    connection: redisConnection(),
  });

  let enqueued = 0;
  for (const row of rows) {
    await addOrReplaceJob(
      embedQueue,
      "embed-document",
      { documentId: row.id, workspaceId: row.workspace_id },
      `doc-embed-${row.id}`,
      {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );
    enqueued += 1;
    console.log("enqueued document-embed", row.title ?? row.id);
  }

  await embedQueue.close();
  await client.end();
  console.log(`Enqueued ${enqueued} document-embed job(s). Ensure the worker is running.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
