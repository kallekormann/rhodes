/**
 * When true, blob uploads/downloads may use monorepo `.data/` if Supabase Storage fails.
 * Production and Docker dev must use Supabase Storage only (single source of truth).
 */
export function allowLocalStorageFallback(): boolean {
  const flag = process.env.RHODES_ALLOW_LOCAL_STORAGE_FALLBACK;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  if (process.env.RHODES_IN_DOCKER === "1") return false;
  if (process.env.NODE_ENV === "production") return false;
  // Default off — opt in only for laptop-only dev without Supabase Storage.
  return false;
}
