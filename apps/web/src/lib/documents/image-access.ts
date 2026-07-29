import type { SupabaseClient } from "@supabase/supabase-js";

const READ_ACCESS_CACHE_MS = 60_000;
const readAccessCache = new Map<string, { ok: boolean; expires: number }>();

function readAccessCacheKey(userId: string, documentId: string): string {
  return `${userId}:${documentId}`;
}

export async function canWriteDocumentImage(
  supabase: SupabaseClient,
  documentId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_write_document", {
    doc_id: documentId,
  });

  return !error && data === true;
}

export async function canReadDocumentImage(
  supabase: SupabaseClient,
  path: string,
  userId?: string | null,
): Promise<boolean> {
  const [workspaceId, documentId] = path.split("/");
  if (!workspaceId || !documentId) {
    return false;
  }

  if (userId) {
    const cached = readAccessCache.get(readAccessCacheKey(userId, documentId));
    if (cached && cached.expires > Date.now()) {
      return cached.ok;
    }
  }

  const { data: isMember } = await supabase.rpc("is_workspace_member", {
    ws_id: workspaceId,
  });
  if (isMember) {
    if (userId) {
      readAccessCache.set(readAccessCacheKey(userId, documentId), {
        ok: true,
        expires: Date.now() + READ_ACCESS_CACHE_MS,
      });
    }
    return true;
  }

  const { data: isShared } = await supabase.rpc("is_document_shared_with_user", {
    doc_id: documentId,
  });

  const ok = isShared === true;
  if (userId) {
    readAccessCache.set(readAccessCacheKey(userId, documentId), {
      ok,
      expires: Date.now() + READ_ACCESS_CACHE_MS,
    });
  }
  return ok;
}
