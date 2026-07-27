/**
 * Encrypt/decrypt Yjs offline conflict snapshot state in rhodes-db meta.
 */

import type { EncryptedBlob } from "@/lib/offline/db";
import { decryptDocsJson, encryptDocsJson } from "@/lib/offline/docs-vault";

/** Stored in meta — state is AES-GCM encrypted base64 Yjs update. */
export type OfflineYjsSnapshotStored = {
  state_enc: EncryptedBlob;
  capturedAt: string;
};

/** Legacy plaintext rows (pre slice 5). */
export type OfflineYjsSnapshotLegacy = {
  state: string;
  capturedAt: string;
};

export type OfflineYjsSnapshot = {
  state: string;
  capturedAt: string;
};

export async function encryptOfflineYjsSnapshot(
  snapshot: OfflineYjsSnapshot,
): Promise<OfflineYjsSnapshotStored> {
  return {
    state_enc: await encryptDocsJson(snapshot.state),
    capturedAt: snapshot.capturedAt,
  };
}

export async function decryptOfflineYjsSnapshot(
  stored: OfflineYjsSnapshotStored | OfflineYjsSnapshotLegacy,
): Promise<OfflineYjsSnapshot> {
  if ("state_enc" in stored && stored.state_enc) {
    return {
      state: await decryptDocsJson<string>(stored.state_enc),
      capturedAt: stored.capturedAt,
    };
  }
  if ("state" in stored && typeof stored.state === "string") {
    return { state: stored.state, capturedAt: stored.capturedAt };
  }
  throw new Error("Invalid offline Yjs snapshot");
}
