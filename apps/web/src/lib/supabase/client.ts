import { createBrowserClient } from "@supabase/ssr";
import { resetRealtimeAuthCache } from "@/lib/supabase/ensure-realtime-auth";
import { getBrowserSupabaseUrl } from "@/lib/supabase/urls";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | undefined;

export function createClient(): BrowserClient {
  const url = getBrowserSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase public environment variables");
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
    browserClient.auth.onAuthStateChange(() => {
      resetRealtimeAuthCache();
    });
  }

  return browserClient;
}
