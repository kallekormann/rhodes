"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import * as Y from "yjs";
import {
  type BlockConflict,
  type ProseMirrorJsonNode,
  detectOfflineBlockConflicts,
  isOfflineMergeSettled,
} from "@/lib/offline/yjs-offline-divergence";
import { setBlockFromJson, setBlockPlainText } from "@/lib/offline/yjs-block-resolution";
import {
  claimOfflineConflictReview,
  clearOfflineSnapshots,
  getOfflineBase,
  getOfflineMine,
  offlineSnapshotToDoc,
  ownsOfflineConflictReview,
  resetOfflineConflictClaim,
  snapshotYDoc,
  storeOfflineBase,
  storeOfflineMine,
} from "@/lib/offline/yjs-offline-snapshot";
import { uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";

const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}`;

function toSnapshot(bytes: Uint8Array) {
  return {
    state: uint8ToBase64(bytes),
    capturedAt: new Date().toISOString(),
  };
}

/** Reconstruct peer edits by diffing the post-sync merged doc against offline mine. */
function buildTheirsDoc(
  baseSnapshot: { state: string; capturedAt: string },
  mineDoc: Y.Doc,
  mergedDoc: Y.Doc,
): Y.Doc {
  const theirsDoc = offlineSnapshotToDoc(baseSnapshot);
  const theirsDelta = Y.encodeStateAsUpdate(
    mergedDoc,
    Y.encodeStateVector(mineDoc),
  );
  if (theirsDelta.length > 0) {
    Y.applyUpdate(theirsDoc, theirsDelta, "offline-conflict");
  }
  return theirsDoc;
}

export function useOfflineYjsConflict(params: {
  documentId: string | null;
  ydoc: Y.Doc | null;
  synced: boolean;
  catchupComplete: boolean;
  online: boolean;
  getEditor: () => Editor | null;
  flushPersist: () => void;
}) {
  const {
    documentId,
    ydoc,
    synced,
    catchupComplete,
    online,
    getEditor,
    flushPersist,
  } = params;
  const [conflicts, setConflicts] = useState<BlockConflict[]>([]);
  const [reviewPending, setReviewPending] = useState(false);
  const pendingBaseSnapshotRef = useRef<Uint8Array | null>(null);
  const pendingMineSnapshotRef = useRef<Uint8Array | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const lastCheckedMergedRef = useRef<string | null>(null);
  const prevOnlineRef = useRef(online);
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const hasOfflineSession = useCallback(() => {
    return pendingBaseSnapshotRef.current != null;
  }, []);

  const captureMine = useCallback(() => {
    if (!ydoc) return;
    pendingMineSnapshotRef.current = snapshotYDoc(ydoc);
    if (documentId) {
      void storeOfflineMine(documentId, pendingMineSnapshotRef.current);
    }
  }, [documentId, ydoc]);

  const runDetection = useCallback(async () => {
    if (!documentId || !ydoc || !online || !synced) return;
    if (reviewPending || conflicts.length > 0) return;

    const mergedKey = uint8ToBase64(snapshotYDoc(ydoc));
    if (mergedKey === lastCheckedMergedRef.current) return;
    lastCheckedMergedRef.current = mergedKey;

    const baseSnapshot =
      pendingBaseSnapshotRef.current != null
        ? toSnapshot(pendingBaseSnapshotRef.current)
        : await getOfflineBase(documentId);
    if (!baseSnapshot) return;

    await resetOfflineConflictClaim(documentId);
    await claimOfflineConflictReview(documentId, TAB_ID);

    const mineSnapshot =
      pendingMineSnapshotRef.current != null
        ? toSnapshot(pendingMineSnapshotRef.current)
        : ((await getOfflineMine(documentId)) ?? baseSnapshot);

    const baseDoc = offlineSnapshotToDoc(baseSnapshot);
    const mineDoc = offlineSnapshotToDoc(mineSnapshot);
    const mergedDoc = offlineSnapshotToDoc({
      state: uint8ToBase64(snapshotYDoc(ydoc)),
      capturedAt: new Date().toISOString(),
    });
    const theirsDoc = buildTheirsDoc(baseSnapshot, mineDoc, mergedDoc);

    const found = detectOfflineBlockConflicts(
      baseDoc,
      mineDoc,
      theirsDoc,
      mergedDoc,
    );

    const settled = isOfflineMergeSettled(
      baseDoc,
      mineDoc,
      theirsDoc,
      mergedDoc,
    );

    baseDoc.destroy();
    mineDoc.destroy();
    mergedDoc.destroy();
    theirsDoc.destroy();

    if (found.length > 0) {
      setConflicts(found);
      setReviewPending(true);
      return;
    }

    if (settled) {
      await clearOfflineSnapshots(documentId);
      pendingBaseSnapshotRef.current = null;
      pendingMineSnapshotRef.current = null;
      lastCheckedMergedRef.current = null;
    }
  }, [
    catchupComplete,
    conflicts.length,
    documentId,
    online,
    reviewPending,
    synced,
    ydoc,
  ]);

  const scheduleDetection = useCallback(() => {
    if (!hasOfflineSession() && !documentId) return;
    if (detectionTimerRef.current != null) {
      window.clearTimeout(detectionTimerRef.current);
    }
    detectionTimerRef.current = window.setTimeout(() => {
      detectionTimerRef.current = null;
      void runDetection();
    }, 50);
  }, [documentId, hasOfflineSession, runDetection]);

  const snapshotBase = useCallback(() => {
    if (!documentId || !ydoc) return;
    const base = snapshotYDoc(ydoc);
    pendingBaseSnapshotRef.current = base;
    pendingMineSnapshotRef.current = base;
    lastCheckedMergedRef.current = null;
    void resetOfflineConflictClaim(documentId);
    void storeOfflineBase(documentId, base);
    void storeOfflineMine(documentId, base);
  }, [documentId, ydoc]);

  // React online state (reliable with DevTools offline) + window offline event.
  useEffect(() => {
    if (!documentId || !ydoc) return;

    if (prevOnlineRef.current && !online) {
      snapshotBase();
    }

    if (!prevOnlineRef.current && online && pendingBaseSnapshotRef.current) {
      captureMine();
      scheduleDetection();
    }

    prevOnlineRef.current = online;
  }, [captureMine, documentId, online, scheduleDetection, snapshotBase, ydoc]);

  useEffect(() => {
    if (!documentId || !ydoc) return;

    const onOffline = () => {
      snapshotBase();
    };

    const onMineUpdate = () => {
      if (onlineRef.current) return;
      if (!pendingBaseSnapshotRef.current) return;
      captureMine();
    };

    window.addEventListener("offline", onOffline);
    ydoc.on("update", onMineUpdate);
    return () => {
      window.removeEventListener("offline", onOffline);
      ydoc.off("update", onMineUpdate);
    };
  }, [captureMine, documentId, snapshotBase, ydoc]);

  useEffect(() => {
    if (!documentId || !ydoc) return;

    const onOnline = () => {
      if (!pendingBaseSnapshotRef.current) return;
      captureMine();
    };

    window.addEventListener("online", onOnline, { capture: true });
    return () => window.removeEventListener("online", onOnline, { capture: true });
  }, [captureMine, documentId, ydoc]);

  useEffect(() => {
    if (!documentId || !ydoc || !online) return;
    if (!hasOfflineSession()) return;
    scheduleDetection();
  }, [catchupComplete, documentId, hasOfflineSession, online, scheduleDetection, synced, ydoc]);

  useEffect(() => {
    if (!documentId || !ydoc || !online) return;
    if (!hasOfflineSession()) return;

    const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === "offline-conflict") return;
      if (reviewPending || conflicts.length > 0) return;
      lastCheckedMergedRef.current = null;
      scheduleDetection();
    };

    ydoc.on("update", onDocUpdate);
    return () => {
      ydoc.off("update", onDocUpdate);
      if (detectionTimerRef.current != null) {
        window.clearTimeout(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
    };
  }, [
    conflicts.length,
    documentId,
    hasOfflineSession,
    online,
    reviewPending,
    scheduleDetection,
    ydoc,
  ]);

  useEffect(() => {
    pendingBaseSnapshotRef.current = null;
    pendingMineSnapshotRef.current = null;
    lastCheckedMergedRef.current = null;
    prevOnlineRef.current = online;
    setConflicts([]);
    setReviewPending(false);
  }, [documentId]);

  const resolveBlock = useCallback(
    async (blockId: string, text: string, blockJson?: ProseMirrorJsonNode) => {
      const editor = getEditor();
      if (!editor) return false;
      if (blockJson?.type && setBlockFromJson(editor, blockId, blockJson)) {
        return true;
      }
      return setBlockPlainText(editor, blockId, text);
    },
    [getEditor],
  );

  const keepMine = useCallback(
    async (blockId: string) => {
      const conflict = conflicts.find((c) => c.blockId === blockId);
      if (!conflict) return;
      await resolveBlock(blockId, conflict.mineText, conflict.mineBlock);
      setConflicts((prev) => prev.filter((c) => c.blockId !== blockId));
    },
    [conflicts, resolveBlock],
  );

  const takeTheirs = useCallback(
    async (blockId: string) => {
      const conflict = conflicts.find((c) => c.blockId === blockId);
      if (!conflict) return;
      await resolveBlock(blockId, conflict.theirsText, conflict.theirsBlock);
      setConflicts((prev) => prev.filter((c) => c.blockId !== blockId));
    },
    [conflicts, resolveBlock],
  );

  const keepAllMine = useCallback(async () => {
    for (const conflict of conflicts) {
      await resolveBlock(conflict.blockId, conflict.mineText, conflict.mineBlock);
    }
    setConflicts([]);
  }, [conflicts, resolveBlock]);

  const takeAllTheirs = useCallback(async () => {
    for (const conflict of conflicts) {
      await resolveBlock(
        conflict.blockId,
        conflict.theirsText,
        conflict.theirsBlock,
      );
    }
    setConflicts([]);
  }, [conflicts, resolveBlock]);

  useEffect(() => {
    if (conflicts.length > 0 || !reviewPending) return;
    if (!documentId) return;

    void (async () => {
      if (!(await ownsOfflineConflictReview(documentId, TAB_ID))) return;
      flushPersist();
      await clearOfflineSnapshots(documentId);
      setReviewPending(false);
      pendingBaseSnapshotRef.current = null;
      pendingMineSnapshotRef.current = null;
      lastCheckedMergedRef.current = null;
    })();
  }, [conflicts.length, documentId, flushPersist, reviewPending]);

  return {
    offlineConflictBlocks: conflicts,
    offlineConflictReviewPending: reviewPending,
    snapshotOfflineBase: snapshotBase,
    keepOfflineMine: keepMine,
    takeOfflineTheirs: takeTheirs,
    keepAllOfflineMine: keepAllMine,
    takeAllOfflineTheirs: takeAllTheirs,
  };
}
