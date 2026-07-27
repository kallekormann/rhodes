/**
 * One-time cleanup of legacy per-document y-indexeddb databases (M1b.1 slice 10).
 */

import { getOfflineDB } from "@/lib/offline/db";
import { clearYjsIndexedDbPersistence } from "@/lib/collaboration/yjs-idb";

const CLEANUP_META_KEY = "legacy_yjs_idb_cleaned_v1";
const UUID_DB_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function cleanupLegacyYjsIndexedDbDatabases(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const db = await getOfflineDB();
  const already = await db.get("meta", CLEANUP_META_KEY);
  if (already === true) return;

  const databases =
    typeof indexedDB.databases === "function"
      ? await indexedDB.databases()
      : [];

  await Promise.all(
    databases
      .map((entry) => entry.name)
      .filter((name): name is string => typeof name === "string")
      .filter((name) => name !== "rhodes-db" && UUID_DB_NAME.test(name))
      .map((name) => clearYjsIndexedDbPersistence(name)),
  );

  await db.put("meta", true, CLEANUP_META_KEY);
}
