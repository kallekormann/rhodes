import { healthResponseSchema } from "@rhodes/shared";
import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";

async function checkSupabase(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return false;
  }

  try {
    const client = createClient(url, anonKey);
    const { error } = await client.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return false;
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
}

export async function GET() {
  const [supabase, redis] = await Promise.all([checkSupabase(), checkRedis()]);

  const healthy = supabase && redis;

  const payload = healthResponseSchema.parse({
    status: healthy ? "ok" : "degraded",
    supabase,
    redis,
  });

  return Response.json(payload, {
    status: healthy ? 200 : 503,
  });
}
