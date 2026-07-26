import * as Y from "yjs";
import { getOfflineDB } from "@/lib/offline/db";
import { uint8ToBase64, base64ToUint8 } from "@/lib/collaboration/supabase-yjs-provider";

export type OfflineYjsSnapshot = {
  state: string;
  capturedAt: string;
};

function offlineBaseKey(documentId: string): string {
  return `offline_base:${documentId}`;
}

function offlineMineKey(documentId: string): string {
  return `offline_mine:${documentId}`;
}

function offlineConflictClaimKey(documentId: string): string {
  return `owns_offline_conflict:${documentId}`;
}

export function snapshotYDoc(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function docFromSnapshot(state: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  return doc;
}

async function putMeta<T>(key: string, value: T): Promise<void> {
  const db = await getOfflineDB();
  await db.put("meta", value, key);
}

async function getMeta<T>(key: string): Promise<T | null> {
  const db = await getOfflineDB();
  const value = await db.get("meta", key);
  return (value as T | undefined) ?? null;
}

async function deleteMeta(key: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("meta", key);
}

export async function storeOfflineBase(
  documentId: string,
  state: Uint8Array,
  capturedAt: string = new Date().toISOString(),
): Promise<void> {
  const snapshot: OfflineYjsSnapshot = {
    state: uint8ToBase64(state),
    capturedAt,
  };
  await putMeta(offlineBaseKey(documentId), snapshot);
}

export async function getOfflineBase(
  documentId: string,
): Promise<OfflineYjsSnapshot | null> {
  return getMeta<OfflineYjsSnapshot>(offlineBaseKey(documentId));
}

export async function storeOfflineMine(
  documentId: string,
  state: Uint8Array,
): Promise<void> {
  const snapshot: OfflineYjsSnapshot = {
    state: uint8ToBase64(state),
    capturedAt: new Date().toISOString(),
  };
  await putMeta(offlineMineKey(documentId), snapshot);
}

export async function getOfflineMine(
  documentId: string,
): Promise<OfflineYjsSnapshot | null> {
  return getMeta<OfflineYjsSnapshot>(offlineMineKey(documentId));
}

export async function clearOfflineSnapshots(documentId: string): Promise<void> {
  await Promise.all([
    deleteMeta(offlineBaseKey(documentId)),
    deleteMeta(offlineMineKey(documentId)),
    deleteMeta(offlineConflictClaimKey(documentId)),
  ]);
  clearOfflineSessionMarker(documentId);
}

const OFFLINE_SESSION_MARKER_PREFIX = "rhodes:offline-session:";

/** Tab-scoped, invalidated on every full page load (hard refresh). */
const PAGE_LOAD_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `load-${Date.now()}`;

/** Tab-scoped flag: this browser session has unmerged offline edits for the doc. */
export function markOfflineSessionPending(documentId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      `${OFFLINE_SESSION_MARKER_PREFIX}${documentId}`,
      PAGE_LOAD_ID,
    );
  } catch {
    /* private mode */
  }
}

export function hasOfflineSessionMarker(documentId: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return (
      sessionStorage.getItem(`${OFFLINE_SESSION_MARKER_PREFIX}${documentId}`) ===
      PAGE_LOAD_ID
    );
  } catch {
    return false;
  }
}

export function clearOfflineSessionMarker(documentId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(`${OFFLINE_SESSION_MARKER_PREFIX}${documentId}`);
  } catch {
    /* private mode */
  }
}

export async function hasActiveOfflineEdits(
  documentId: string,
): Promise<boolean> {
  const [base, mine] = await Promise.all([
    getOfflineBase(documentId),
    getOfflineMine(documentId),
  ]);
  if (!base || !mine) return false;
  return base.state !== mine.state;
}

/**
 * True when IDB holds unmerged offline edits for a session that is still active
 * in this tab (or the tab is still offline on load).
 */
export async function shouldResumeOfflineSession(
  documentId: string,
): Promise<boolean> {
  const pending = await hasActiveOfflineEdits(documentId);
  if (!pending) return false;
  if (hasOfflineSessionMarker(documentId)) return true;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

export async function clearStaleOfflineSnapshots(
  documentId: string,
): Promise<void> {
  const [base, mine] = await Promise.all([
    getOfflineBase(documentId),
    getOfflineMine(documentId),
  ]);
  if (base && mine && base.state === mine.state) {
    await clearOfflineSnapshots(documentId);
    return;
  }
  const pending = await hasActiveOfflineEdits(documentId);
  if (!pending) {
    await clearOfflineSnapshots(documentId);
    return;
  }
  if (!(await shouldResumeOfflineSession(documentId))) {
    await clearOfflineSnapshots(documentId);
  }
}

export async function resetOfflineConflictClaim(
  documentId: string,
): Promise<void> {
  await deleteMeta(offlineConflictClaimKey(documentId));
}

/** Only one tab per document may own the offline conflict review UI. */
export async function claimOfflineConflictReview(
  documentId: string,
  tabId: string,
): Promise<boolean> {
  const key = offlineConflictClaimKey(documentId);
  await putMeta(key, tabId);
  return true;
}

export async function ownsOfflineConflictReview(
  documentId: string,
  tabId: string,
): Promise<boolean> {
  const existing = await getMeta<string>(offlineConflictClaimKey(documentId));
  return existing === tabId;
}

export function offlineSnapshotToDoc(snapshot: OfflineYjsSnapshot): Y.Doc {
  return docFromSnapshot(base64ToUint8(snapshot.state));
}
