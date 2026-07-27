/**
 * Rhodes client IndexedDB — Phase 09 offline foundation.
 * Ask conversations are client-only (encrypted) and must never sync to the server.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "rhodes-db";
/** v6: ensure yjs_state exists without wiping the DB (repair via version bump). */
const DB_VERSION = 6;

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};

export type OfflineSyncStatus = "synced" | "pending" | "conflict";

export type OfflineDocumentRecord = {
  id: string;
  workspace_id: string;
  title: string;
  content: Record<string, unknown> | null;
  content_plain: string | null;
  metadata: Record<string, unknown> | null;
  /** Last known server updated_at — used as expected_updated_at on push. */
  server_updated_at: string;
  updated_at: string;
  created_at: string;
  sync_status: OfflineSyncStatus;
};

/** Encrypted-at-rest shape stored in the documents object store (M1b.1). */
export type OfflineDocumentStorageRecord = {
  id: string;
  workspace_id: string;
  title: string;
  content_enc: EncryptedBlob | null;
  content_plain_enc: EncryptedBlob | null;
  metadata_enc: EncryptedBlob | null;
  server_updated_at: string;
  updated_at: string;
  created_at: string;
  sync_status: OfflineSyncStatus;
};

export type OfflineOutboxRecord = {
  id?: number;
  document_id: string;
  mutation: "patch" | "create" | "delete";
  payload: Record<string, unknown>;
  /** Server updated_at this patch is based on (optimistic concurrency). */
  expected_updated_at: string;
  created_at: string;
  retries: number;
};

/** Encrypted-at-rest shape stored in the outbox object store (M1b.1). */
export type OfflineOutboxStorageRecord = {
  id?: number;
  document_id: string;
  mutation: "patch" | "create" | "delete";
  payload_enc: EncryptedBlob;
  expected_updated_at: string;
  created_at: string;
  retries: number;
};

/** @deprecated v1 plaintext thread — migrated into encrypted conversations */
export type AskThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/** @deprecated v1 store */
export type AskThreadRecord = {
  id: string;
  user_id: string;
  workspace_id: string;
  messages: AskThreadMessage[];
  updated_at: string;
};

export type ConversationKind = "ask";

export type ConversationRecord = {
  id: string;
  user_id: string;
  workspace_id: string;
  kind: ConversationKind;
  document_id?: string | null;
  /** Plaintext for History list */
  title: string;
  /** Plaintext preview snippet for History list */
  preview: string;
  messages_enc: EncryptedBlob;
  created_at: string;
  updated_at: string;
};

export type VaultRecord = {
  id: string;
  dek_jwk: JsonWebKey;
  created_at: string;
};

/** Encrypted live Yjs CRDT state (M1b.1 slices 6–11). */
export type YjsStateStorageRecord = {
  documentId: string;
  state_enc: EncryptedBlob;
  updated_at: string;
};

type RhodesDB = DBSchema & {
  documents: {
    key: string;
    value: OfflineDocumentStorageRecord;
    indexes: { "by-workspace": string };
  };
  outbox: {
    key: number;
    value: OfflineOutboxStorageRecord;
    indexes: { "by-document": string };
  };
  /** @deprecated retained for one-time migration */
  ask_threads: {
    key: string;
    value: AskThreadRecord;
    indexes: { "by-user": string };
  };
  conversations: {
    key: string;
    value: ConversationRecord;
    indexes: {
      "by-user": string;
      "by-workspace-kind": [string, string, string];
    };
  };
  vault: {
    key: string;
    value: VaultRecord;
  };
  meta: {
    key: string;
    value: unknown;
  };
  yjs_state: {
    key: string;
    value: YjsStateStorageRecord;
  };
};

let dbPromise: Promise<IDBPDatabase<RhodesDB>> | null = null;

function upgradeRhodesDb(
  db: IDBPDatabase<RhodesDB>,
  oldVersion: number,
): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains("documents")) {
      const documents = db.createObjectStore("documents", {
        keyPath: "id",
      });
      documents.createIndex("by-workspace", "workspace_id");
    }
    if (!db.objectStoreNames.contains("outbox")) {
      const outbox = db.createObjectStore("outbox", {
        keyPath: "id",
        autoIncrement: true,
      });
      outbox.createIndex("by-document", "document_id");
    }
    if (!db.objectStoreNames.contains("ask_threads")) {
      const threads = db.createObjectStore("ask_threads", {
        keyPath: "id",
      });
      threads.createIndex("by-user", "user_id");
    }
    if (!db.objectStoreNames.contains("meta")) {
      db.createObjectStore("meta");
    }
  }

  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains("conversations")) {
      const conversations = db.createObjectStore("conversations", {
        keyPath: "id",
      });
      conversations.createIndex("by-user", "user_id");
      conversations.createIndex("by-workspace-kind", [
        "user_id",
        "workspace_id",
        "kind",
      ]);
    }
    if (!db.objectStoreNames.contains("vault")) {
      db.createObjectStore("vault", { keyPath: "id" });
    }
  }

  if (oldVersion < 3) {
    // M1b.1: disposable plaintext cache — drop and recreate encrypted stores.
    if (db.objectStoreNames.contains("documents")) {
      db.deleteObjectStore("documents");
    }
    const documents = db.createObjectStore("documents", {
      keyPath: "id",
    });
    documents.createIndex("by-workspace", "workspace_id");

    if (db.objectStoreNames.contains("outbox")) {
      db.deleteObjectStore("outbox");
    }
    const outbox = db.createObjectStore("outbox", {
      keyPath: "id",
      autoIncrement: true,
    });
    outbox.createIndex("by-document", "document_id");
  }

  if (oldVersion < 4) {
    // M1b.1 slice 4: outbox payload encryption — clear disposable plaintext rows.
    if (db.objectStoreNames.contains("outbox")) {
      db.deleteObjectStore("outbox");
    }
    const outbox = db.createObjectStore("outbox", {
      keyPath: "id",
      autoIncrement: true,
    });
    outbox.createIndex("by-document", "document_id");
  }

  if (oldVersion < 5) {
    if (!db.objectStoreNames.contains("yjs_state")) {
      db.createObjectStore("yjs_state", { keyPath: "documentId" });
    }
  }

  if (oldVersion < 6) {
    // Soft repair: create yjs_state if a v5 DB was missing it — never wipe.
    if (!db.objectStoreNames.contains("yjs_state")) {
      db.createObjectStore("yjs_state", { keyPath: "documentId" });
    }
  }
}

/**
 * Drop cached connection after DevTools DB delete, HMR, or browser termination.
 * Also clear in-memory DEKs so we never encrypt with a key that no longer
 * matches the vault store after a wipe.
 */
export function resetOfflineDBConnection(): void {
  dbPromise = null;
  // Dynamic import avoids circular deps (vault modules import getOfflineDB).
  void import("@/lib/offline/offline-vault-session")
    .then((m) => {
      m.lockOfflineVaults();
    })
    .catch(() => {
      /* vault modules may not be ready during HMR dispose */
    });
}

async function openRhodesDb(): Promise<IDBPDatabase<RhodesDB>> {
  let connection: IDBPDatabase<RhodesDB> | null = null;
  connection = await openDB<RhodesDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      upgradeRhodesDb(db, oldVersion);
    },
    blocked() {
      console.warn(
        "[rhodes-db] open blocked — close other tabs using IndexedDB",
      );
    },
    blocking() {
      connection?.close();
      resetOfflineDBConnection();
    },
    terminated() {
      resetOfflineDBConnection();
    },
  });
  return connection;
}

export function getOfflineDB(): Promise<IDBPDatabase<RhodesDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }
  if (!dbPromise) {
    // Assign immediately so concurrent callers share one open attempt.
    dbPromise = openRhodesDb().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

if (typeof module !== "undefined" && (module as { hot?: { dispose: (cb: () => void) => void } }).hot) {
  (module as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
    resetOfflineDBConnection();
  });
}

export function activeConversationMetaKey(
  workspaceId: string,
  kind: ConversationKind = "ask",
): string {
  return `active_conversation:${workspaceId}:${kind}`;
}

export async function getOrCreateClientId(): Promise<string> {
  const db = await getOfflineDB();
  const existing = await db.get("meta", "client_id");
  if (typeof existing === "string" && existing.length > 0) return existing;
  const clientId = crypto.randomUUID();
  await db.put("meta", clientId, "client_id");
  return clientId;
}

export async function getActiveConversationId(
  workspaceId: string,
  kind: ConversationKind = "ask",
): Promise<string | null> {
  const db = await getOfflineDB();
  const value = await db.get("meta", activeConversationMetaKey(workspaceId, kind));
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function setActiveConversationId(
  workspaceId: string,
  conversationId: string | null,
  kind: ConversationKind = "ask",
): Promise<void> {
  const db = await getOfflineDB();
  const key = activeConversationMetaKey(workspaceId, kind);
  if (conversationId) {
    await db.put("meta", conversationId, key);
  } else {
    await db.delete("meta", key);
  }
}

export async function getYjsState(
  documentId: string,
): Promise<YjsStateStorageRecord | null> {
  const db = await getOfflineDB();
  const row = await db.get("yjs_state", documentId);
  return row ?? null;
}

export async function putYjsState(record: YjsStateStorageRecord): Promise<void> {
  const db = await getOfflineDB();
  await db.put("yjs_state", record);
}

export async function deleteYjsState(documentId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("yjs_state", documentId);
}

/** Clear document/outbox sync cache. Keeps Ask conversations + vault. */
export async function clearSyncedOfflineCache(): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction(["documents", "outbox", "yjs_state"], "readwrite");
  await Promise.all([
    tx.objectStore("documents").clear(),
    tx.objectStore("outbox").clear(),
    tx.objectStore("yjs_state").clear(),
  ]);
  await tx.done;
}

/** Wipe Ask conversations + vault for one user (account delete). */
export async function wipeAskDataForUser(userId: string): Promise<void> {
  const db = await getOfflineDB();
  const conversationKeys = await db.getAllKeysFromIndex(
    "conversations",
    "by-user",
    userId,
  );
  const legacyKeys = db.objectStoreNames.contains("ask_threads")
    ? await db.getAllKeysFromIndex("ask_threads", "by-user", userId)
    : [];

  const tx = db.transaction(
    ["conversations", "vault", "meta", "ask_threads"],
    "readwrite",
  );

  await Promise.all([
    ...conversationKeys.map((key) =>
      tx.objectStore("conversations").delete(key),
    ),
    tx.objectStore("vault").delete(userId),
    ...legacyKeys.map((key) => tx.objectStore("ask_threads").delete(key)),
  ]);

  const metaStore = tx.objectStore("meta");
  const allMetaKeys = await metaStore.getAllKeys();
  await Promise.all(
    allMetaKeys
      .filter(
        (key) =>
          typeof key === "string" && key.startsWith("active_conversation:"),
      )
      .map((key) => metaStore.delete(key)),
  );

  await tx.done;
}

/**
 * Full local wipe — account delete / nuclear reset.
 * Prefer wipeAskDataForUser + clearSyncedOfflineCache for targeted cleanup.
 * Call wipeAskDataForUser(userId) before this when deleting an account so the
 * in-memory vault DEK is also dropped via deleteVaultForUser / lockVault.
 */
export async function clearOfflineCache(): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction(
    [
      "documents",
      "outbox",
      "yjs_state",
      "conversations",
      "vault",
      "meta",
      "ask_threads",
    ],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("documents").clear(),
    tx.objectStore("outbox").clear(),
    tx.objectStore("yjs_state").clear(),
    tx.objectStore("conversations").clear(),
    tx.objectStore("vault").clear(),
    tx.objectStore("meta").clear(),
    tx.objectStore("ask_threads").clear(),
  ]);
  await tx.done;
}

/** @deprecated use conversation helpers — kept for migration callers */
export function askThreadKey(userId: string, workspaceId: string): string {
  return `${userId}:${workspaceId}`;
}

/** @deprecated */
export async function loadAskThread(
  userId: string,
  workspaceId: string,
): Promise<AskThreadMessage[]> {
  const db = await getOfflineDB();
  if (!db.objectStoreNames.contains("ask_threads")) return [];
  const row = await db.get("ask_threads", askThreadKey(userId, workspaceId));
  return row?.messages ?? [];
}

/** @deprecated */
export async function saveAskThread(
  userId: string,
  workspaceId: string,
  messages: AskThreadMessage[],
): Promise<void> {
  const db = await getOfflineDB();
  if (!db.objectStoreNames.contains("ask_threads")) return;
  const record: AskThreadRecord = {
    id: askThreadKey(userId, workspaceId),
    user_id: userId,
    workspace_id: workspaceId,
    messages,
    updated_at: new Date().toISOString(),
  };
  await db.put("ask_threads", record);
}

/** @deprecated */
export async function clearAskThreadsForUser(userId: string): Promise<void> {
  await wipeAskDataForUser(userId);
}
