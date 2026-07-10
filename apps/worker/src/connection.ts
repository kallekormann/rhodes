import type { ConnectionOptions } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const connection: ConnectionOptions = {
  url: redisUrl,
  maxRetriesPerRequest: null,
};
