"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import * as Y from "yjs";
import {
  type BlockConflict,
  type ProseMirrorJsonNode,
  detectOfflineBlockConflicts,
} from "@/lib/offline/yjs-offline-divergence";
import { setBlockFromJson, setBlockPlainText } from "@/lib/offline/yjs-block-resolution";
import {
  claimOfflineConflictReview,
  clearOfflineSnapshots,
  getOfflineBase,
  getOfflineMine,
  offlineSnapshotToDoc,
  ownsOfflineConflictReview,
  snapshotYDoc,
  storeOfflineBase,
  storeOfflineMine,
} from "@/lib/offline/yjs-offline-snapshot";
import { uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";

const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}`;

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
  const detectionRanRef = useRef(false);
  const wasOfflineRef = useRef(false);
  const pendingMineSnapshotRef = useRef<Uint8Array | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const lastCheckedMergedRef = useRef<string | null>(null);

  const runDetection = useCallback(async () => {
    if (!documentId || !ydoc || !online || !synced || !catchupComplete) return;
    if (detectionRanRef.current) return;

    const mergedKey = uint8ToBase64(snapshotYDoc(ydoc));
    if (mergedKey === lastCheckedMergedRef.current) return;
    lastCheckedMergedRef.current = mergedKey;

    const baseSnapshot = await getOfflineBase(documentId);
    if (!baseSnapshot) return;

    const ownsReview = await claimOfflineConflictReview(documentId, TAB_ID);
    if (!ownsReview) {
      await clearOfflineSnapshots(documentId);
      return;
    }

    const mineSnapshot =
      pendingMineSnapshotRef.current != null
        ? {
            state: uint8ToBase64(pendingMineSnapshotRef.current),
            capturedAt: new Date().toISOString(),
          }
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

    baseDoc.destroy();
    mineDoc.destroy();
    mergedDoc.destroy();
    theirsDoc.destroy();

    if (found.length === 0) {
      return;
    }

    detectionRanRef.current = true;
    setConflicts(found);
    setReviewPending(true);
  }, [catchupComplete, documentId, online, synced, ydoc]);

  const scheduleDetection = useCallback(() => {
    if (detectionTimerRef.current != null) {
      window.clearTimeout(detectionTimerRef.current);
    }
    detectionTimerRef.current = window.setTimeout(() => {
      detectionTimerRef.current = null;
      void runDetection();
    }, 50);
  }, [runDetection]);

  const snapshotBase = useCallback(() => {
    if (!documentId || !ydoc) return;
    void storeOfflineBase(documentId, snapshotYDoc(ydoc));
    wasOfflineRef.current = true;
  }, [documentId, ydoc]);

  // Capture base on disconnect / offline.
  useEffect(() => {
    if (!documentId || !ydoc) return;

    const onOffline = () => {
      detectionRanRef.current = false;
      lastCheckedMergedRef.current = null;
      snapshotBase();
    };
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, [documentId, snapshotBase, ydoc]);

  // Capture mine synchronously on online (capture phase) before reconnect merges remote state.
  useEffect(() => {
    if (!documentId || !ydoc) return;

    const onOnline = () => {
      const mine = snapshotYDoc(ydoc);
      pendingMineSnapshotRef.current = mine;
      void storeOfflineMine(documentId, mine);
    };

    window.addEventListener("online", onOnline, { capture: true });
    return () => window.removeEventListener("online", onOnline, { capture: true });
  }, [documentId, ydoc]);

  // After peer catch-up, detect Case C overlaps for the reconnecting tab only.
  useEffect(() => {
    if (!documentId || !ydoc || !online || !synced || !catchupComplete) return;
    if (detectionRanRef.current) return;
    scheduleDetection();
  }, [catchupComplete, documentId, online, scheduleDetection, synced, ydoc]);

  // Re-check after CRDT applies peer step2 (may arrive after an early zero-conflict pass).
  useEffect(() => {
    if (!documentId || !ydoc || !online || !catchupComplete) return;

    const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === "offline-conflict") return;
      if (detectionRanRef.current || reviewPending) return;
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
  }, [catchupComplete, documentId, online, reviewPending, scheduleDetection, ydoc]);

  useEffect(() => {
    detectionRanRef.current = false;
    setConflicts([]);
    setReviewPending(false);
    pendingMineSnapshotRef.current = null;
    lastCheckedMergedRef.current = null;
    wasOfflineRef.current = false;
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
      wasOfflineRef.current = false;
      detectionRanRef.current = true;
    })();
  }, [conflicts.length, documentId, flushPersist, reviewPending]);

  // No conflicts after catch-up settles — clear offline snapshots.
  useEffect(() => {
    if (!documentId || !catchupComplete || reviewPending || conflicts.length > 0) {
      return;
    }
    if (detectionTimerRef.current != null) return;

    const timer = window.setTimeout(() => {
      if (detectionRanRef.current || reviewPending) return;
      void getOfflineBase(documentId).then((base) => {
        if (!base) return;
        detectionRanRef.current = true;
        void clearOfflineSnapshots(documentId);
        wasOfflineRef.current = false;
      });
    }, 2_000);

    return () => window.clearTimeout(timer);
  }, [catchupComplete, conflicts.length, documentId, reviewPending]);

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
