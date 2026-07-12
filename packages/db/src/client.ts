import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      // Node 20 has no global WebSocket — use `ws` for storage/realtime clients.
      transport: WebSocket as unknown as NonNullable<
        NonNullable<Parameters<typeof createClient>[2]>["realtime"]
      >["transport"],
    },
  });
}
