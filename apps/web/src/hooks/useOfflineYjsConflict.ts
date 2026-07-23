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
import { blockJsonFromPlainText, replaceBlockForConflict, setBlockFromJson, setBlockPlainText } from "@/lib/offline/yjs-block-resolution";
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
import { base64ToUint8, uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";
import type {
  BlockResolutionPayload,
  SupabaseYjsProvider,
} from "@/lib/collaboration/supabase-yjs-provider";

const OFFLINE_CONFLICT_ORIGIN = "offline-conflict-restore";

function restoreYDocToSnapshot(ydoc: Y.Doc, mineSnapshot: Uint8Array): void {
  const mineDoc = new Y.Doc();
  Y.applyUpdate(mineDoc, mineSnapshot);
  const restore = Y.encodeStateAsUpdate(mineDoc, Y.encodeStateVector(ydoc));
  if (restore.length > 0) {
    Y.applyUpdate(ydoc, restore, OFFLINE_CONFLICT_ORIGIN);
  }
  mineDoc.destroy();
}

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
  /** Yjs update origin used for remote/provider-applied edits — never snapshot these. */
  remoteUpdateOrigin?: unknown;
  provider?: SupabaseYjsProvider | null;
  getEditor: () => Editor | null;
  flushPersist: () => void;
}) {
  const {
    documentId,
    ydoc,
    synced,
    catchupComplete,
    online,
    remoteUpdateOrigin,
    provider,
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
  const offlineSessionActiveRef = useRef(false);
  const mineSnapshotLockedRef = useRef(false);
  const remoteUpdateOriginRef = useRef(remoteUpdateOrigin);
  remoteUpdateOriginRef.current = remoteUpdateOrigin;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const hasOfflineSession = useCallback(() => {
    return pendingBaseSnapshotRef.current != null;
  }, []);

  const captureMine = useCallback(() => {
    if (!ydoc || mineSnapshotLockedRef.current) return;
    pendingMineSnapshotRef.current = snapshotYDoc(ydoc);
    if (documentId) {
      void storeOfflineMine(documentId, pendingMineSnapshotRef.current);
    }
  }, [documentId, ydoc]);

  const endOfflineReview = useCallback(() => {
    providerRef.current?.setOfflineReviewActive(false);
    offlineSessionActiveRef.current = false;
    mineSnapshotLockedRef.current = false;
  }, []);

  const runDetection = useCallback(async () => {
    if (!documentId || !ydoc || !online || !synced || !catchupComplete) return;
    if (reviewPending || conflicts.length > 0) return;

    const baseSnapshot =
      pendingBaseSnapshotRef.current != null
        ? toSnapshot(pendingBaseSnapshotRef.current)
        : await getOfflineBase(documentId);
    if (!baseSnapshot) return;

    const mineSnapshot =
      pendingMineSnapshotRef.current != null
        ? toSnapshot(pendingMineSnapshotRef.current)
        : ((await getOfflineMine(documentId)) ?? baseSnapshot);

    const mineBytes =
      pendingMineSnapshotRef.current ?? base64ToUint8(mineSnapshot.state);

    // Peer merge leaked into the live doc — restore mine before detecting.
    const liveBytes = snapshotYDoc(ydoc);
    if (uint8ToBase64(liveBytes) !== uint8ToBase64(mineBytes)) {
      providerRef.current?.setOfflineReviewActive(true);
      restoreYDocToSnapshot(ydoc, mineBytes);
    }

    const mergedState = (() => {
      const currentProvider = providerRef.current;
      if (currentProvider?.isDeferringPeerUpdates) {
        return currentProvider.getDeferredMergedState();
      }
      return snapshotYDoc(ydoc);
    })();

    const mergedKey = uint8ToBase64(mergedState);
    if (mergedKey === lastCheckedMergedRef.current) return;
    lastCheckedMergedRef.current = mergedKey;

    await resetOfflineConflictClaim(documentId);
    await claimOfflineConflictReview(documentId, TAB_ID);

    const baseDoc = offlineSnapshotToDoc(baseSnapshot);
    const mineDoc = offlineSnapshotToDoc(mineSnapshot);
    const mergedDoc = offlineSnapshotToDoc({
      state: uint8ToBase64(mergedState),
      capturedAt: new Date().toISOString(),
    });
    const theirsDoc = buildTheirsDoc(baseSnapshot, mineDoc, mergedDoc);

    const found = detectOfflineBlockConflicts(
      baseDoc,
      mineDoc,
      theirsDoc,
      mergedDoc,
      { catchupComplete },
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
      providerRef.current?.discardDeferredPeerUpdates();
      restoreYDocToSnapshot(ydoc, mineBytes);
      setConflicts(found);
      setReviewPending(true);
      return;
    }

    if (settled) {
      providerRef.current?.releaseDeferredPeerUpdates();
      await clearOfflineSnapshots(documentId);
      pendingBaseSnapshotRef.current = null;
      pendingMineSnapshotRef.current = null;
      lastCheckedMergedRef.current = null;
      endOfflineReview();
      providerRef.current?.resetBroadcastBaseline();
      providerRef.current?.flushPersist();
      providerRef.current?.broadcastPendingLocalUpdates();
    }
  }, [
    catchupComplete,
    conflicts.length,
    documentId,
    endOfflineReview,
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

  const beginOnlineReview = useCallback(() => {
    if (!ydoc || !documentId) return;

    const startReview = (mineBytes: Uint8Array) => {
      mineSnapshotLockedRef.current = true;
      providerRef.current?.setOfflineReviewActive(true);
      restoreYDocToSnapshot(ydoc, mineBytes);
      lastCheckedMergedRef.current = null;
      scheduleDetection();
    };

    // Synchronous path — normal reconnect after an in-session offline edit.
    if (pendingBaseSnapshotRef.current && pendingMineSnapshotRef.current) {
      startReview(pendingMineSnapshotRef.current);
      return;
    }

    void (async () => {
      if (!pendingBaseSnapshotRef.current) {
        const baseSnap = await getOfflineBase(documentId);
        if (!baseSnap) return;
        pendingBaseSnapshotRef.current = base64ToUint8(baseSnap.state);
        offlineSessionActiveRef.current = true;
      }

      let mineBytes = pendingMineSnapshotRef.current;
      if (!mineBytes) {
        const mineSnap = await getOfflineMine(documentId);
        if (mineSnap) {
          mineBytes = base64ToUint8(mineSnap.state);
        } else if (pendingBaseSnapshotRef.current) {
          mineBytes = pendingBaseSnapshotRef.current;
        }
        if (mineBytes) {
          pendingMineSnapshotRef.current = mineBytes;
        }
      }

      if (!pendingBaseSnapshotRef.current || !mineBytes) return;
      startReview(mineBytes);
    })();
  }, [documentId, scheduleDetection, ydoc]);

  const snapshotBase = useCallback(() => {
    if (!documentId || !ydoc) return;
    if (offlineSessionActiveRef.current) return;

    const base = snapshotYDoc(ydoc);
    pendingBaseSnapshotRef.current = base;
    pendingMineSnapshotRef.current = base;
    lastCheckedMergedRef.current = null;
    offlineSessionActiveRef.current = true;
    mineSnapshotLockedRef.current = false;
    providerRef.current?.setOfflineReviewActive(true);
    void resetOfflineConflictClaim(documentId);
    void storeOfflineBase(documentId, base);
    void storeOfflineMine(documentId, base);
  }, [documentId, ydoc]);

  // Resume an offline editing session after reload (snapshots live in IndexedDB).
  useEffect(() => {
    if (!documentId || !ydoc) return;

    let cancelled = false;
    void (async () => {
      const [baseSnap, mineSnap] = await Promise.all([
        getOfflineBase(documentId),
        getOfflineMine(documentId),
      ]);
      if (cancelled || !baseSnap || !mineSnap || baseSnap.state === mineSnap.state) {
        return;
      }

      pendingBaseSnapshotRef.current = base64ToUint8(baseSnap.state);
      pendingMineSnapshotRef.current = base64ToUint8(mineSnap.state);
      offlineSessionActiveRef.current = true;
      providerRef.current?.setOfflineReviewActive(true);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        beginOnlineReview();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [beginOnlineReview, documentId, ydoc]);

  // React online state (reliable with DevTools offline) + window offline event.
  useEffect(() => {
    if (!documentId || !ydoc) return;

    if (prevOnlineRef.current && !online) {
      snapshotBase();
    }

    if (!prevOnlineRef.current && online) {
      beginOnlineReview();
    }

    prevOnlineRef.current = online;
  }, [beginOnlineReview, documentId, online, snapshotBase, ydoc]);

  useEffect(() => {
    if (!documentId || !ydoc) return;

    const onOffline = () => {
      snapshotBase();
    };

    const onMineUpdate = (_update: Uint8Array, origin: unknown) => {
      if (!offlineSessionActiveRef.current || mineSnapshotLockedRef.current) return;
      if (!pendingBaseSnapshotRef.current) return;
      const remoteOrigin = remoteUpdateOriginRef.current;
      if (remoteOrigin != null && origin === remoteOrigin) return;
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
      beginOnlineReview();
    };

    window.addEventListener("online", onOnline, { capture: true });
    return () => window.removeEventListener("online", onOnline, { capture: true });
  }, [beginOnlineReview, documentId, ydoc]);

  useEffect(() => {
    if (!provider) return;
    provider.setOnPeerUpdatesDeferred(() => {
      if (!hasOfflineSession()) return;
      lastCheckedMergedRef.current = null;
      scheduleDetection();
    });
    return () => provider.setOnPeerUpdatesDeferred(null);
  }, [hasOfflineSession, provider, scheduleDetection]);

  useEffect(() => {
    if (!documentId || !ydoc || !online) return;
    if (!hasOfflineSession()) return;
    scheduleDetection();
  }, [catchupComplete, documentId, hasOfflineSession, online, scheduleDetection, synced, ydoc]);

  useEffect(() => {
    if (!documentId || !ydoc || !online) return;
    if (!hasOfflineSession()) return;

    const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === "offline-conflict" || origin === OFFLINE_CONFLICT_ORIGIN) return;
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
    providerRef.current?.setOfflineReviewActive(false);
    offlineSessionActiveRef.current = false;
    mineSnapshotLockedRef.current = false;
    setConflicts([]);
    setReviewPending(false);
  }, [documentId]);

  const resolveBlock = useCallback(
    async (
      blockId: string,
      text: string,
      blockJson?: ProseMirrorJsonNode,
    ): Promise<ProseMirrorJsonNode | null> => {
      const editor = getEditor();
      if (!editor) return null;

      const resolved =
        replaceBlockForConflict(editor, blockId, text, blockJson) ??
        (blockJson?.type && setBlockFromJson(editor, blockId, blockJson)
          ? blockJson
          : setBlockPlainText(editor, blockId, text)
            ? blockJsonFromPlainText(editor, blockId, text)
            : null);

      return resolved;
    },
    [getEditor],
  );

  const broadcastResolvedBlock = useCallback(
    (blockId: string, block: ProseMirrorJsonNode) => {
      const payload: BlockResolutionPayload = { blockId, block };
      providerRef.current?.broadcastBlockResolution(payload);
    },
    [],
  );

  const applyRemoteBlockResolution = useCallback(
    (payload: BlockResolutionPayload) => {
      if (offlineSessionActiveRef.current) return;
      const editor = getEditor();
      const provider = providerRef.current;
      if (!editor || !provider) return;

      provider.runWithoutOutgoingUpdates(() => {
        replaceBlockForConflict(
          editor,
          payload.blockId,
          "",
          payload.block as ProseMirrorJsonNode,
        );
      });
      provider.flushPersist();
    },
    [getEditor],
  );

  useEffect(() => {
    if (!provider) return;
    return provider.onBlockResolution((payload) => {
      applyRemoteBlockResolution(payload);
    });
  }, [applyRemoteBlockResolution, provider]);

  const keepMine = useCallback(
    async (blockId: string) => {
      const conflict = conflicts.find((c) => c.blockId === blockId);
      if (!conflict) return;
      const block =
        (await resolveBlock(blockId, conflict.mineText, conflict.mineBlock)) ??
        conflict.mineBlock;
      if (block) {
        broadcastResolvedBlock(blockId, block);
      }
      setConflicts((prev) => prev.filter((c) => c.blockId !== blockId));
    },
    [broadcastResolvedBlock, conflicts, resolveBlock],
  );

  const takeTheirs = useCallback(
    async (blockId: string) => {
      const conflict = conflicts.find((c) => c.blockId === blockId);
      if (!conflict) return;
      const block =
        (await resolveBlock(
          blockId,
          conflict.theirsText,
          conflict.theirsBlock,
        )) ?? conflict.theirsBlock;
      if (block) {
        broadcastResolvedBlock(blockId, block);
      }
      setConflicts((prev) => prev.filter((c) => c.blockId !== blockId));
    },
    [broadcastResolvedBlock, conflicts, resolveBlock],
  );

  const keepAllMine = useCallback(async () => {
    for (const conflict of conflicts) {
      const block =
        (await resolveBlock(
          conflict.blockId,
          conflict.mineText,
          conflict.mineBlock,
        )) ?? conflict.mineBlock;
      if (block) {
        broadcastResolvedBlock(conflict.blockId, block);
      }
    }
    setConflicts([]);
  }, [broadcastResolvedBlock, conflicts, resolveBlock]);

  const takeAllTheirs = useCallback(async () => {
    for (const conflict of conflicts) {
      const block =
        (await resolveBlock(
          conflict.blockId,
          conflict.theirsText,
          conflict.theirsBlock,
        )) ?? conflict.theirsBlock;
      if (block) {
        broadcastResolvedBlock(conflict.blockId, block);
      }
    }
    setConflicts([]);
  }, [broadcastResolvedBlock, conflicts, resolveBlock]);

  useEffect(() => {
    if (conflicts.length > 0 || !reviewPending) return;
    if (!documentId) return;

    void (async () => {
      if (!(await ownsOfflineConflictReview(documentId, TAB_ID))) return;
      providerRef.current?.discardDeferredPeerUpdates();
      await clearOfflineSnapshots(documentId);
      setReviewPending(false);
      pendingBaseSnapshotRef.current = null;
      pendingMineSnapshotRef.current = null;
      lastCheckedMergedRef.current = null;
      endOfflineReview();
      providerRef.current?.resetBroadcastBaseline();
      flushPersist();
    })();
  }, [conflicts.length, documentId, endOfflineReview, flushPersist, reviewPending]);

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
