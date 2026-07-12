import { Queue, Worker } from "bullmq";
import {
  DOCUMENT_EMBED_QUEUE,
  LIBRARY_EMBED_QUEUE,
  LIBRARY_INGEST_QUEUE,
  LIBRARY_SUMMARIZE_QUEUE,
  LLM_QUEUE,
} from "@rhodes/shared/constants";
import { connection } from "./connection";
import { processEmbedDocumentJob } from "./jobs/embed-document";
import { processEmbedJob } from "./jobs/embed";
import { processIngestJob } from "./jobs/ingest";
import { processLlmJob } from "./jobs/llm-generate";
import { processSummarizeJob } from "./jobs/summarize";

const heartbeatQueue = new Queue("heartbeat", { connection });

/** Ollama calls can take minutes on CPU — avoid false stall detection. */
const LONG_JOB_WORKER_OPTS = {
  connection,
  lockDuration: 300_000,
  stalledInterval: 30_000,
  maxStalledCount: 2,
} as const;

const ingestWorker = new Worker(
  LIBRARY_INGEST_QUEUE,
  async (job) => processIngestJob(job),
  { ...LONG_JOB_WORKER_OPTS, concurrency: 3 },
);

const embedWorker = new Worker(
  LIBRARY_EMBED_QUEUE,
  async (job) => processEmbedJob(job),
  { ...LONG_JOB_WORKER_OPTS, concurrency: 2 },
);

const summarizeWorker = new Worker(
  LIBRARY_SUMMARIZE_QUEUE,
  async (job) => processSummarizeJob(job),
  { ...LONG_JOB_WORKER_OPTS, concurrency: 2 },
);

const documentEmbedWorker = new Worker(
  DOCUMENT_EMBED_QUEUE,
  async (job) => processEmbedDocumentJob(job),
  { ...LONG_JOB_WORKER_OPTS, concurrency: 1 },
);

const llmWorker = new Worker(
  LLM_QUEUE,
  async (job) => processLlmJob(job),
  { ...LONG_JOB_WORKER_OPTS, concurrency: 2 },
);

const heartbeatWorker = new Worker(
  "heartbeat",
  async () => {
    console.log("[worker] heartbeat", new Date().toISOString());
  },
  { connection },
);

for (const worker of [
  ingestWorker,
  embedWorker,
  summarizeWorker,
  documentEmbedWorker,
  llmWorker,
  heartbeatWorker,
]) {
  worker.on("active", (job) => {
    console.log(`[worker] ${worker.name} job active`, job.id);
  });
  worker.on("failed", (job, error) => {
    console.error(`[worker] ${worker.name} job failed`, job?.id, error);
  });
  worker.on("completed", (job) => {
    console.log(`[worker] ${worker.name} job completed`, job.id);
  });
}

setInterval(async () => {
  await heartbeatQueue.add(
    "tick",
    { at: new Date().toISOString() },
    { removeOnComplete: 100, removeOnFail: 50 },
  );
}, 30_000);

console.log(
  "[worker] started library ingest, embed, summarize, document-embed, and llm workers",
);

process.on("SIGINT", async () => {
  await Promise.all([
    ingestWorker.close(),
    embedWorker.close(),
    summarizeWorker.close(),
    documentEmbedWorker.close(),
    llmWorker.close(),
    heartbeatWorker.close(),
    heartbeatQueue.close(),
  ]);
  process.exit(0);
});
