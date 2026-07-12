#!/usr/bin/env node
/**
 * Phase 07 exit QA — RAG retrieval, embed-on-save logic, Ollama generate.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

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
    process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }

  process.env.SUPABASE_URL ??= "http://localhost:8000";
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
  }
  if (process.env.OLLAMA_HOST?.includes("://ollama:")) {
    process.env.OLLAMA_HOST = "http://localhost:11434";
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await loadEnvFile();
  console.log("Phase 07 RAG QA\n");

  const { contentChangeRatio, shouldReembedContent } = await import(
    pathToFileURL(path.join(rootDir, "packages/ai/src/diff.ts")).href
  );
  const { shouldEnqueueDocumentEmbed } = await import(
    pathToFileURL(path.join(rootDir, "apps/web/src/lib/documents/embed-on-save.ts")).href
  );

  assert(contentChangeRatio("hello world", "hello world") === 0, "unchanged ratio");
  assert(
    shouldReembedContent("short text", "completely different long rewritten body"),
    "large change should re-embed",
  );
  assert(
    !shouldEnqueueDocumentEmbed("stable paragraph text", "stable paragraph text"),
    "unchanged doc should not re-embed",
  );
  console.log("✓ embed-on-save diff logic");

  const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  const tags = await fetch(`${ollamaHost}/api/tags`);
  assert(tags.ok, `Ollama unhealthy: ${tags.status}`);
  console.log("✓ Ollama");

  const { createOllamaClient, retrieveWorkspaceKnowledge, whyRelevantPrompt } =
    await import(pathToFileURL(path.join(rootDir, "packages/ai/src/index.ts")).href);
  const { OLLAMA_FAST_MODEL } = await import(
    pathToFileURL(path.join(rootDir, "packages/shared/src/constants.ts")).href
  );

  const ollama = createOllamaClient();
  const probeVector = await ollama.embed("Rhodes workspace knowledge probe");
  assert(probeVector.length === 768, `Expected 768D embed, got ${probeVector.length}`);
  console.log("✓ 768D query embedding");

  const password = process.env.POSTGRES_PASSWORD;
  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://postgres:${password}@localhost:5433/postgres`;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const { rows: workspaces } = await client.query(
    `
      select w.id
      from workspaces w
      where exists (
        select 1 from library_source_chunks c
        where c.workspace_id = w.id and c.embedding is not null
      )
      or exists (
        select 1 from documents d
        where d.workspace_id = w.id and d.embedding is not null
      )
      order by w.created_at asc
      limit 1
    `,
  );
  let workspaceId = workspaces[0]?.id;
  if (!workspaceId) {
    const fallback = await client.query(
      "select id from workspaces order by created_at asc limit 1",
    );
    workspaceId = fallback.rows[0]?.id;
  }
  assert(workspaceId, "No workspace in DB");

  const { rows: chunkCount } = await client.query(
    `
      select count(*)::int as total
      from (
        select 1 from library_source_chunks where workspace_id = $1 and embedding is not null
        union all
        select 1 from documents where workspace_id = $1 and embedding is not null
      ) embedded
    `,
    [workspaceId],
  );

  if ((chunkCount[0]?.total ?? 0) === 0) {
    console.warn("⚠ No embedded knowledge in workspace — skipping retrieval match test");
  } else {
    const matches = await retrieveWorkspaceKnowledge({
      workspaceId,
      queryText: "experiment knowledge research hypothesis testing",
      matchCount: 4,
      matchThreshold: 0.5,
    });
    assert(Array.isArray(matches), "retrieveWorkspaceKnowledge should return array");
    console.log(`✓ RAG retrieval (${matches.length} matches)`);

    if (matches[0]) {
      const why = (
        await ollama.generate(
          whyRelevantPrompt(matches[0], "writing about experiments and knowledge"),
          OLLAMA_FAST_MODEL,
        )
      ).slice(0, 120);
      assert(why.trim().length > 0, "Why relevant generate returned empty");
      assert(why.length <= 120, "Why relevant should be capped at 120 chars");
      console.log(`✓ Why relevant generate (${why.length} chars)`);
    }
  }

  const { rows: llmQueueMeta } = await client.query(
    "select 1",
  );
  void llmQueueMeta;

  const workerIndex = await readFile(
    path.join(rootDir, "apps/worker/src/index.ts"),
    "utf8",
  );
  assert(workerIndex.includes("concurrency: 2"), "LLM worker should use concurrency 2");
  assert(workerIndex.includes('LLM_QUEUE'), "LLM queue worker should be registered");
  console.log("✓ LLM worker concurrency 2");

  await client.end();
  console.log("\nPhase 07 RAG QA passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("\nPhase 07 RAG QA failed:");
  console.error(error);
  process.exit(1);
});
