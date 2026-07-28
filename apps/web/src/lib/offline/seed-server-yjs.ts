/**
 * Seed Postgres document_yjs_state from local IDB when body was pushed via JSON only.
 */

import {
  base64ToUint8,
  uint8ToBase64,
} from "@/lib/collaboration/supabase-yjs-provider";
import { getYjsState } from "@/lib/offline/db";
import { decryptDocsJson, isDocsVaultUnlocked } from "@/lib/offline/docs-vault";

export async function seedServerYjsIfEmpty(documentId: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  try {
    const response = await fetch(`/app/api/documents/${documentId}/yjs`);
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (typeof data?.state === "string" && data.state.length > 0) return;

    const row = await getYjsState(documentId);
    if (!row?.state_enc || !isDocsVaultUnlocked()) return;

    const stateB64 = await decryptDocsJson<string>(row.state_enc);
    const state = base64ToUint8(stateB64);
    if (state.length === 0) return;

    await fetch(`/app/api/documents/${documentId}/yjs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: uint8ToBase64(state) }),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[seed-server-yjs] failed", documentId, error);
    }
  }
}
