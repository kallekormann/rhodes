/** Direct Kong URL for server-side and auth redirects (bypasses Next.js proxy). */
export function getServerSupabaseUrl(): string {
  const direct = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (direct) return direct;

  return process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
}

/** Browser client URL — proxied through Next.js in local dev to avoid WS HTTP 431. */
export function getBrowserSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
}

/** Rewrite a server-side Supabase URL so the browser can reach it (Docker / proxy). */
export function toBrowserSupabaseUrl(serverUrl: string): string {
  const serverBase = getServerSupabaseUrl().replace(/\/$/, "");
  const browserBase = getBrowserSupabaseUrl().replace(/\/$/, "");
  if (!serverBase || !browserBase || serverBase === browserBase) {
    return serverUrl;
  }
  if (serverUrl.startsWith(`${serverBase}/`) || serverUrl === serverBase) {
    return browserBase + serverUrl.slice(serverBase.length);
  }
  return serverUrl;
}
