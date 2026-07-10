import { Queue, Worker } from "bullmq";
import { connection } from "./connection";

const heartbeatQueue = new Queue("heartbeat", { connection });

const heartbeatWorker = new Worker(
  "heartbeat",
  async () => {
    console.log("[worker] heartbeat", new Date().toISOString());
  },
  { connection },
);

heartbeatWorker.on("failed", (job, error) => {
  console.error("[worker] job failed", job?.id, error);
});

setInterval(async () => {
  await heartbeatQueue.add(
    "tick",
    { at: new Date().toISOString() },
    { removeOnComplete: 100, removeOnFail: 50 },
  );
}, 30_000);

console.log("[worker] started");

process.on("SIGINT", async () => {
  await heartbeatWorker.close();
  await heartbeatQueue.close();
  process.exit(0);
});
