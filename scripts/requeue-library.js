import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Queue } from "bullmq";
import pg from "pg";

const LIBRARY_INGEST_QUEUE = "library-ingest";
const LIBRARY_EMBED_QUEUE = "library-embed";
const LIBRARY_SUMMARIZE_QUEUE = "library-summarize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function loadEnvFile() {
  const envPath = path.join(rootDir, "docker/.env");
  const content = await readFile(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    process.env[key] = value;
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
    const state = await existing.getState();
    if (state !== "completed") {
      await existing.remove();
    }
  }
  return queue.add(name, data, { ...options, jobId });
}

async function clearOrphanedActiveJobs(queue) {
  const active = await queue.getJobs(["active"], 0, 100);
  for (const job of active) {
    await job.remove();
    console.log("removed orphaned active job", queue.name, job.id);
  }
}

async function main() {
  await loadEnvFile();

  const password = process.env.POSTGRES_PASSWORD;
  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://postgres:${password}@localhost:5433/postgres`;

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const connection = redisConnection();
  const ingestQueue = new Queue(LIBRARY_INGEST_QUEUE, { connection });
  const embedQueue = new Queue(LIBRARY_EMBED_QUEUE, { connection });
  const summarizeQueue = new Queue(LIBRARY_SUMMARIZE_QUEUE, { connection });

  await clearOrphanedActiveJobs(ingestQueue);
  await clearOrphanedActiveJobs(embedQueue);
  await clearOrphanedActiveJobs(summarizeQueue);

  const { rows } = await client.query(`
    select id, workspace_id, file_path, file_type, embedding_status, metadata
    from library_sources
    where embedding_status in ('pending', 'failed', 'processing')
    order by created_at asc
  `);

  if (rows.length === 0) {
    console.log("No pending, failed, or stuck processing sources.");
    await ingestQueue.close();
    await embedQueue.close();
    await summarizeQueue.close();
    await client.end();
    return;
  }

  let requeued = 0;

  for (const row of rows) {
    if (!row.file_type) {
      console.warn("skip (no file_type)", row.id);
      continue;
    }

    const { rows: chunkRows } = await client.query(
      `
        select
          count(*)::int as total,
          count(*) filter (where embedding is null)::int as missing_embeddings
        from library_source_chunks
        where source_id = $1
      `,
      [row.id],
    );

    const total = chunkRows[0]?.total ?? 0;
    const missingEmbeddings = chunkRows[0]?.missing_embeddings ?? 0;
    const excerpt =
      row.metadata &&
      typeof row.metadata === "object" &&
      typeof row.metadata.extracted_text_excerpt === "string"
        ? row.metadata.extracted_text_excerpt
        : null;

    if (total > 0 && missingEmbeddings > 0) {
      await client.query(
        `update library_sources set embedding_status = 'processing' where id = $1`,
        [row.id],
      );

      await addOrReplaceJob(
        embedQueue,
        "embed-chunks",
        { sourceId: row.id, workspaceId: row.workspace_id },
        `embed-${row.id}`,
        { removeOnComplete: 100, removeOnFail: 50 },
      );

      if (typeof excerpt === "string" && excerpt.length > 0) {
        await addOrReplaceJob(
          summarizeQueue,
          "summarize-source",
          { sourceId: row.id, workspaceId: row.workspace_id, excerpt },
          `summarize-${row.id}`,
          { removeOnComplete: 100, removeOnFail: 50 },
        );
      }

      console.log("re-queued embed", row.file_path);
      requeued += 1;
      continue;
    }

    await client.query(
      `update library_sources set embedding_status = 'pending' where id = $1`,
      [row.id],
    );

    await ingestQueue.add(
      "process-file",
      {
        sourceId: row.id,
        workspaceId: row.workspace_id,
        filePath: row.file_path,
        mimeType: row.file_type,
      },
      {
        jobId: `ingest-${row.id}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    console.log("re-queued ingest", row.file_path);
    requeued += 1;
  }

  await ingestQueue.close();
  await embedQueue.close();
  await summarizeQueue.close();
  await client.end();
  console.log(`Re-queued ${requeued} source(s). Watch the worker terminal.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
