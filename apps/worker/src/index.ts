import { Queue, Worker } from "bullmq";
import {
  LIBRARY_EMBED_QUEUE,
  LIBRARY_INGEST_QUEUE,
  LIBRARY_SUMMARIZE_QUEUE,
} from "@rhodes/shared/constants";
import { connection } from "./connection";
import { processEmbedJob } from "./jobs/embed";
import { processIngestJob } from "./jobs/ingest";
import { processSummarizeJob } from "./jobs/summarize";

const heartbeatQueue = new Queue("heartbeat", { connection });

const ingestWorker = new Worker(
  LIBRARY_INGEST_QUEUE,
  async (job) => processIngestJob(job),
  { connection, concurrency: 2 },
);

const embedWorker = new Worker(
  LIBRARY_EMBED_QUEUE,
  async (job) => processEmbedJob(job),
  { connection, concurrency: 1 },
);

const summarizeWorker = new Worker(
  LIBRARY_SUMMARIZE_QUEUE,
  async (job) => processSummarizeJob(job),
  { connection, concurrency: 1 },
);

const heartbeatWorker = new Worker(
  "heartbeat",
  async () => {
    console.log("[worker] heartbeat", new Date().toISOString());
  },
  { connection },
);

for (const worker of [ingestWorker, embedWorker, summarizeWorker, heartbeatWorker]) {
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

console.log("[worker] started library ingest, embed, summarize workers");

process.on("SIGINT", async () => {
  await Promise.all([
    ingestWorker.close(),
    embedWorker.close(),
    summarizeWorker.close(),
    heartbeatWorker.close(),
    heartbeatQueue.close(),
  ]);
  process.exit(0);
});
