#!/usr/bin/env node
/**
 * Phase 06 exit QA — library ingest → embed → ready with PDF + 768D embeddings.
 *
 * Usage:
 *   node scripts/qa-library-pipeline.mjs
 *   node scripts/qa-library-pipeline.mjs --pages 15 --nfr-ms 15000
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { buildTestPdf } from "./lib/build-test-pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const pagesArg = args.find((a) => a.startsWith("--pages="));
const nfrArg = args.find((a) => a.startsWith("--nfr-ms="));
const pageCount = pagesArg ? Number(pagesArg.split("=")[1]) : 15;
const nfrMs = nfrArg ? Number(nfrArg.split("=")[1]) : 15_000;

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
  process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:8000";
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
  }
  process.env.REDIS_URL = (process.env.REDIS_URL ?? "redis://localhost:6379").replace(
    "redis://redis:",
    "redis://localhost:",
  );
  process.env.TIKA_URL = process.env.TIKA_URL?.includes("://tika:")
    ? "http://localhost:9998"
    : (process.env.TIKA_URL ?? "http://localhost:9998");
  process.env.OLLAMA_HOST = process.env.OLLAMA_HOST?.includes("://ollama:")
    ? "http://localhost:11434"
    : (process.env.OLLAMA_HOST ?? "http://localhost:11434");
}

async function preflight() {
  const checks = [
    ["Kong", `${process.env.SUPABASE_URL ?? "http://localhost:8000"}/auth/v1/health`],
    ["Redis", null],
    ["Ollama", `${process.env.OLLAMA_HOST}/api/tags`],
    ["Tika", `${process.env.TIKA_URL}/tika`],
  ];

  for (const [name, url] of checks) {
    if (name === "Redis") {
      const { Queue } = await import("bullmq");
      const queue = new Queue("qa-preflight", {
        connection: { url: process.env.REDIS_URL, maxRetriesPerRequest: 1 },
      });
      try {
        await queue.waitUntilReady();
        console.log(`✓ ${name}`);
      } finally {
        await queue.close();
      }
      continue;
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers:
        name === "Kong" && process.env.ANON_KEY
          ? { apikey: process.env.ANON_KEY }
          : undefined,
    });
    const ok =
      response.ok || (name === "Kong" && (response.status === 200 || response.status === 401));
    if (!ok) throw new Error(`${name} unhealthy: ${response.status}`);
    console.log(`✓ ${name}`);
  }
}

async function importWorkerJob(modulePath, exportName) {
  const moduleUrl = pathToFileURL(path.join(rootDir, modulePath)).href;
  const mod = await import(moduleUrl);
  return mod[exportName];
}

async function ensureWorkspace(admin) {
  const { data: existing } = await admin.from("workspaces").select("id").limit(1);
  if (existing?.[0]?.id) return existing[0].id;

  const { data, error } = await admin
    .from("workspaces")
    .insert({ name: "QA Workspace", is_team_workspace: false })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create QA workspace");
  }

  console.log("Created QA workspace:", data.id);
  return data.id;
}

async function main() {
  await loadEnvFile();
  console.log(`Phase 06 library QA (${pageCount}-page PDF, NFR ${nfrMs}ms)\n`);

  console.log("Preflight…");
  await preflight();

  const { createAdminClient } = await import(
    pathToFileURL(path.join(rootDir, "packages/db/src/client.ts")).href
  );
  const admin = createAdminClient();

  const workspaceId = await ensureWorkspace(admin);

  const sourceId = crypto.randomUUID();
  const fileName = `qa-phase06-${pageCount}p.pdf`;
  const filePath = `${workspaceId}/library/${sourceId}/${fileName}`;
  const pdfBytes = buildTestPdf(pageCount);
  const dataDir = path.join(rootDir, ".data");
  process.env.RHODES_DATA_DIR = dataDir;
  process.env.RHODES_LIBRARY_DATA_DIR = path.join(dataDir, "library-files");

  const { LIBRARY_BUCKET } = await import(
    pathToFileURL(path.join(rootDir, "packages/shared/src/constants.ts")).href
  );

  const { error: uploadError } = await admin.storage
    .from(LIBRARY_BUCKET)
    .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    await mkdir(path.dirname(path.join(dataDir, filePath)), { recursive: true });
    await writeFile(path.join(dataDir, filePath), pdfBytes);
    console.log("⚠ Storage upload failed — using local fallback:", uploadError.message);
  }

  const { error: insertError } = await admin.from("library_sources").insert({
    id: sourceId,
    workspace_id: workspaceId,
    file_name: fileName,
    file_path: filePath,
    file_type: "application/pdf",
    embedding_status: "pending",
    metadata: { byte_size: pdfBytes.length, qa: true },
  });

  if (insertError) throw new Error(insertError.message);

  const processIngestJob = await importWorkerJob(
    "apps/worker/src/jobs/ingest.ts",
    "processIngestJob",
  );
  const processEmbedJob = await importWorkerJob(
    "apps/worker/src/jobs/embed.ts",
    "processEmbedJob",
  );

  const started = Date.now();
  console.log("\nIngest…");
  await processIngestJob({
    id: `qa-ingest-${sourceId}`,
    data: {
      sourceId,
      workspaceId,
      filePath,
      mimeType: "application/pdf",
    },
  });

  const { data: afterIngest } = await admin
    .from("library_sources")
    .select("embedding_status")
    .eq("id", sourceId)
    .single();

  if (afterIngest?.embedding_status !== "processing") {
    throw new Error(`Expected processing after ingest, got ${afterIngest?.embedding_status}`);
  }
  console.log("✓ pending → processing");

  console.log("Embed…");
  await processEmbedJob({
    id: `qa-embed-${sourceId}`,
    data: { sourceId, workspaceId },
  });

  const elapsed = Date.now() - started;

  const { data: source } = await admin
    .from("library_sources")
    .select("embedding_status, summary")
    .eq("id", sourceId)
    .single();

  if (source?.embedding_status !== "ready") {
    throw new Error(`Expected ready after embed, got ${source?.embedding_status}`);
  }
  console.log("✓ processing → ready");

  const password = process.env.POSTGRES_PASSWORD;
  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://postgres:${password}@localhost:5433/postgres`;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const { rows: chunkRows } = await client.query(
    `
      select
        count(*)::int as total,
        count(*) filter (where embedding is not null)::int as embedded,
        min(vector_dims(embedding)) as dims
      from library_source_chunks
      where source_id = $1
    `,
    [sourceId],
  );
  await client.end();

  const { total, embedded, dims } = chunkRows[0] ?? {};
  if (!total || embedded !== total) {
    throw new Error(`Chunks not fully embedded (${embedded}/${total})`);
  }
  if (dims !== 768) {
    throw new Error(`Expected 768D embeddings, got ${dims}`);
  }
  console.log(`✓ ${total} chunks with ${dims}D embeddings`);

  if (elapsed > nfrMs) {
    console.warn(`⚠ NFR: ${elapsed}ms exceeds ${nfrMs}ms budget (hardware-dependent)`);
  } else {
    console.log(`✓ NFR: ${elapsed}ms ≤ ${nfrMs}ms`);
  }

  await admin.from("library_source_chunks").delete().eq("source_id", sourceId);
  await admin.from("library_sources").delete().eq("id", sourceId);
  await admin.storage.from(LIBRARY_BUCKET).remove([filePath]).catch(() => {});

  console.log("\nPhase 06 library pipeline QA passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("\nPhase 06 library pipeline QA failed:");
  console.error(error);
  process.exit(1);
});
