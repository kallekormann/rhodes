/**
 * Rhodes-db Yjs persistence — drop-in replacement for y-indexeddb IndexeddbPersistence.
 */

import * as Y from "yjs";
import {
  base64ToUint8,
  uint8ToBase64,
} from "@/lib/collaboration/supabase-yjs-provider";
import {
  deleteYjsState,
  getYjsState,
  putYjsState,
} from "@/lib/offline/db";
import {
  decryptDocsJson,
  encryptDocsJson,
  isDocsVaultUnlocked,
  unlockDocsVault,
} from "@/lib/offline/docs-vault";

const PERSIST_DEBOUNCE_MS = 1_500;

const activePersistences = new Map<string, RhodesYjsPersistence>();

export class RhodesYjsPersistence {
  readonly whenSynced: Promise<void>;
  private readonly documentId: string;
  private readonly doc: Y.Doc;
  private readonly userId: string | null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private readonly onDocUpdate = () => {
    this.schedulePersist();
  };

  constructor(documentId: string, doc: Y.Doc, userId?: string | null) {
    this.documentId = documentId;
    this.doc = doc;
    this.userId = userId ?? null;
    activePersistences.set(documentId, this);
    this.whenSynced = this.bootstrap();
  }

  private async ensureVault(): Promise<void> {
    if (!this.userId) {
      throw new Error("RhodesYjsPersistence requires userId for docs vault");
    }
    if (!isDocsVaultUnlocked(this.userId)) {
      await unlockDocsVault(this.userId);
    }
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.ensureVault();
      const row = await getYjsState(this.documentId);
      if (row?.state_enc) {
        const stateB64 = await decryptDocsJson<string>(row.state_enc);
        const state = base64ToUint8(stateB64);
        if (state.length > 0) {
          Y.applyUpdate(this.doc, state);
        }
      }
    } catch (error) {
      console.error("[RhodesYjsPersistence] bootstrap failed", error);
    }
    if (!this.destroyed) {
      this.doc.on("update", this.onDocUpdate);
    }
  }

  private schedulePersist(): void {
    if (this.destroyed) return;
    if (this.persistTimer != null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void this.flush();
    }, PERSIST_DEBOUNCE_MS);
  }

  async flushNow(): Promise<void> {
    if (this.persistTimer != null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.writeState();
  }

  private async flush(): Promise<void> {
    if (this.destroyed) return;
    await this.writeState();
  }

  private async writeState(): Promise<void> {
    try {
      await persistLocalYjsState(
        this.documentId,
        Y.encodeStateAsUpdate(this.doc),
        this.userId,
      );
    } catch (error) {
      console.error("[RhodesYjsPersistence] flush failed", error);
    }
  }

  destroy(): void {
    if (this.persistTimer != null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.doc.off("update", this.onDocUpdate);
    if (activePersistences.get(this.documentId) === this) {
      activePersistences.delete(this.documentId);
    }
    void this.flushNow();
    this.destroyed = true;
  }
}

/** Flush debounced Yjs bytes for a document (e.g. before navigation or sync). */
export async function flushRhodesYjsPersistence(
  documentId: string,
): Promise<void> {
  const persistence = activePersistences.get(documentId);
  if (persistence) {
    await persistence.flushNow();
  }
}

/** Online reload: Postgres wins over stale local Yjs state. */
export async function clearRhodesYjsPersistence(documentId: string): Promise<void> {
  await deleteYjsState(documentId);
}

/** Write encrypted Yjs bytes to rhodes-db (offline or server-fallback). */
export async function persistLocalYjsState(
  documentId: string,
  state: Uint8Array,
  userId?: string | null,
): Promise<void> {
  if (!userId) {
    throw new Error("persistLocalYjsState requires userId for docs vault");
  }
  if (!isDocsVaultUnlocked(userId)) {
    await unlockDocsVault(userId);
  }
  const state_enc = await encryptDocsJson(uint8ToBase64(state));
  await putYjsState({
    documentId,
    state_enc,
    updated_at: new Date().toISOString(),
  });
}
