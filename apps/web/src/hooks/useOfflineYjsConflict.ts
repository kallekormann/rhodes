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
import {
  buildBlockReviewModels,
  type BlockReviewModel,
} from "@/lib/offline/base-aligned-review";
import { peerEditContributorsForBlock } from "@/lib/offline/peer-edit-contributions";
import {
  clustersFromBlockConflicts,
  type SpanConflictCluster,
  type SpanConflictVariantSide,
} from "@/lib/offline/span-conflict-clusters";
import {
  claimOfflineConflictReview,
  clearOfflineSnapshots,
  clearStaleOfflineSnapshots,
  getOfflineBase,
  getOfflineMine,
  markOfflineSessionPending,
  offlineSnapshotToDoc,
  ownsOfflineConflictReview,
  resetOfflineConflictClaim,
  shouldResumeOfflineSession,
  snapshotYDoc,
  storeOfflineBase,
  storeOfflineMine,
} from "@/lib/offline/yjs-offline-snapshot";
import { applyHunkToText } from "@/lib/documents/text-diff";
import {
  blockJsonFromPlainText,
  replaceBlockForConflict,
  setBlockFromJson,
  setBlockPlainText,
} from "@/lib/offline/yjs-block-resolution";
import {
  forceYDocBodyFromProsemirrorDoc,
  forceYDocBodyFromSnapshot,
  OFFLINE_CONFLICT_RESTORE_ORIGIN,
  ydocBodyMatchesSnapshot,
} from "@/lib/offline/yjs-offline-restore";
import { base64ToUint8, uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";
import type {
  BlockResolutionPayload,
  SupabaseYjsProvider,
} from "@/lib/collaboration/supabase-yjs-provider";

function syncConflictBlocksToMine(ydoc: Y.Doc, mineBytes: Uint8Array): void {
  forceYDocBodyFromSnapshot(ydoc, mineBytes, OFFLINE_CONFLICT_RESTORE_ORIGIN);
}

function restoreToMineSnapshot(ydoc: Y.Doc, mineSnapshot: Uint8Array): void {
  forceYDocBodyFromSnapshot(ydoc, mineSnapshot, OFFLINE_CONFLICT_RESTORE_ORIGIN);
}

function syncResolvedYDoc(
  ydoc: Y.Doc,
  getEditor: () => Editor | null,
  side: "mine" | "theirs",
  mineBytes: Uint8Array | null,
): void {
  if (side === "mine" && mineBytes) {
    forceYDocBodyFromSnapshot(ydoc, mineBytes, OFFLINE_CONFLICT_RESTORE_ORIGIN);
    return;
  }
  const editor = getEditor();
  if (!editor) return;
  forceYDocBodyFromProsemirrorDoc(
    ydoc,
    editor.state.doc,
    OFFLINE_CONFLICT_RESTORE_ORIGIN,
  );
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
  const [clusters, setClusters] = useState<SpanConflictCluster[]>([]);
  const [reviews, setReviews] = useState<BlockReviewModel[]>([]);
  const [reviewPending, setReviewPending] = useState(false);
  const workingBlockTextRef = useRef<Map<string, string>>(new Map());
  const pendingBaseSnapshotRef = useRef<Uint8Array | null>(null);
  const pendingMineSnapshotRef = useRef<Uint8Array | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const lastCheckedMergedRef = useRef<string | null>(null);
  const prevOnlineRef = useRef(online);
  const offlineSessionActiveRef = useRef(false);
  const mineSnapshotLockedRef = useRef(false);
  const pendingBroadcastsRef = useRef<BlockResolutionPayload[]>([]);
  const manualConflictResolutionRef = useRef(false);
  const conflictReviewArmedRef = useRef(false);
  const reviewShieldApplyingRef = useRef(false);
  const remoteUpdateOriginRef = useRef(remoteUpdateOrigin);
  remoteUpdateOriginRef.current = remoteUpdateOrigin;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const hasOfflineSession = useCallback(() => {
    return (
      offlineSessionActiveRef.current && pendingBaseSnapshotRef.current != null
    );
  }, []);

  const clearOfflineConflictSession = useCallback(async () => {
    offlineSessionActiveRef.current = false;
    mineSnapshotLockedRef.current = false;
    pendingBaseSnapshotRef.current = null;
    pendingMineSnapshotRef.current = null;
    lastCheckedMergedRef.current = null;
    providerRef.current?.setOfflineReviewActive(false);
    providerRef.current?.setOfflineSessionPending(false);
    if (documentId) {
      await clearOfflineSnapshots(documentId);
    }
  }, [documentId]);

  const captureMine = useCallback(() => {
    if (!ydoc || mineSnapshotLockedRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine) return;
    if (!pendingBaseSnapshotRef.current) return;
    pendingMineSnapshotRef.current = snapshotYDoc(ydoc);
    if (documentId) {
      void storeOfflineMine(documentId, pendingMineSnapshotRef.current);
      markOfflineSessionPending(documentId);
    }
  }, [documentId, ydoc]);

  const endOfflineReview = useCallback(() => {
    providerRef.current?.setOfflineReviewActive(false);
    providerRef.current?.setOfflineSessionPending(false);
    offlineSessionActiveRef.current = false;
    mineSnapshotLockedRef.current = false;
    if (documentId) {
      void clearOfflineSnapshots(documentId);
    }
  }, [documentId]);

  const flushPendingBroadcasts = useCallback(() => {
    const pending = pendingBroadcastsRef.current;
    if (pending.length === 0) return;
    pendingBroadcastsRef.current = [];
    for (const payload of pending) {
      providerRef.current?.broadcastBlockResolution(payload);
    }
  }, []);

  const armOfflineReviewShield = useCallback(
    (mineBytes: Uint8Array) => {
      if (!ydoc) return;
      mineSnapshotLockedRef.current = true;
      providerRef.current?.setOfflineReviewActive(true);
      restoreToMineSnapshot(ydoc, mineBytes);
      lastCheckedMergedRef.current = null;
    },
    [ydoc],
  );

  const restoreToMineIfNeeded = useCallback(
    (mineBytes: Uint8Array) => {
      if (!ydoc) return;
      const liveBytes = snapshotYDoc(ydoc);
      if (uint8ToBase64(liveBytes) !== uint8ToBase64(mineBytes)) {
        restoreToMineSnapshot(ydoc, mineBytes);
      }
      lastCheckedMergedRef.current = null;
    },
    [ydoc],
  );

  const runDetection = useCallback(async () => {
    if (!documentId || !ydoc || !online || !synced) return;
    if (!offlineSessionActiveRef.current) return;
    if (
      !catchupComplete &&
      !providerRef.current?.isDeferringPeerUpdates
    ) {
      return;
    }
    if (conflictReviewArmedRef.current || reviewPending || conflicts.length > 0) {
      return;
    }

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
    const baseBytes = base64ToUint8(baseSnapshot.state);

    // Snapshots taken without real offline edits (e.g. stale disconnect capture)
    // must never rewind a doc that already merged peer/server content.
    if (uint8ToBase64(mineBytes) === uint8ToBase64(baseBytes)) {
      await clearOfflineConflictSession();
      return;
    }

    // Peer merge leaked into the live doc — restore mine before detecting.
    const liveBytes = snapshotYDoc(ydoc);
    if (uint8ToBase64(liveBytes) !== uint8ToBase64(mineBytes)) {
      restoreToMineSnapshot(ydoc, mineBytes);
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
      conflictReviewArmedRef.current = true;
      armOfflineReviewShield(mineBytes);
      syncConflictBlocksToMine(ydoc, mineBytes);

      const nextClusters = clustersFromBlockConflicts(found);
      const peerContributorsByBlock = new Map<string, ReturnType<typeof peerEditContributorsForBlock>>();
      const deferredUpdates = providerRef.current?.getDeferredPeerUpdates() ?? [];
      const awareness = providerRef.current?.awareness;
      if (awareness && deferredUpdates.length > 0) {
        for (const conflict of found) {
          peerContributorsByBlock.set(
            conflict.blockId,
            peerEditContributorsForBlock({
              baseSnapshot,
              deferredUpdates,
              awareness,
              blockId: conflict.blockId,
              blockIndex: conflict.blockIndex,
            }),
          );
        }
      }
      const nextReviews = buildBlockReviewModels(
        found,
        nextClusters,
        peerContributorsByBlock,
      );
      workingBlockTextRef.current = new Map(
        found.map((c) => [
          `${c.blockId}:${c.blockIndex}`,
          c.mineText,
        ]),
      );
      setConflicts(found);
      setClusters(nextClusters);
      setReviews(nextReviews);
      setReviewPending(true);
      return;
    }

    if (settled && !conflictReviewArmedRef.current) {
      providerRef.current?.releaseDeferredPeerUpdates();
      await clearOfflineSnapshots(documentId);
      pendingBaseSnapshotRef.current = null;
      pendingMineSnapshotRef.current = null;
      lastCheckedMergedRef.current = null;
      setConflicts([]);
      setClusters([]);
      setReviews([]);
      setReviewPending(false);
      endOfflineReview();
      providerRef.current?.resetBroadcastBaseline();
      flushPendingBroadcasts();
      providerRef.current?.broadcastPendingLocalUpdates();
      providerRef.current?.nudgeLocalAwareness();
    }
  }, [
    armOfflineReviewShield,
    catchupComplete,
    conflicts.length,
    documentId,
    endOfflineReview,
    flushPendingBroadcasts,
    online,
    clearOfflineConflictSession,
    getEditor,
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

    // Freeze the offline mine snapshot before reconnect / server sync can merge peer edits in.
    mineSnapshotLockedRef.current = true;

    const startMergeCheck = (mineBytes: Uint8Array) => {
      restoreToMineIfNeeded(mineBytes);
      scheduleDetection();
      window.setTimeout(() => {
        void runDetection();
      }, 0);
    };

    // Synchronous path — normal reconnect after an in-session offline edit.
    if (pendingBaseSnapshotRef.current && pendingMineSnapshotRef.current) {
      startMergeCheck(pendingMineSnapshotRef.current);
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
      startMergeCheck(mineBytes);
    })();
  }, [documentId, restoreToMineIfNeeded, runDetection, scheduleDetection, ydoc]);

  const snapshotBase = useCallback(() => {
    if (!documentId || !ydoc) return;
    if (offlineSessionActiveRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine) return;

    const base = snapshotYDoc(ydoc);
    pendingBaseSnapshotRef.current = base;
    pendingMineSnapshotRef.current = base;
    lastCheckedMergedRef.current = null;
    offlineSessionActiveRef.current = true;
    mineSnapshotLockedRef.current = false;
    void resetOfflineConflictClaim(documentId);
    void storeOfflineBase(documentId, base);
    void storeOfflineMine(documentId, base);
    markOfflineSessionPending(documentId);
    providerRef.current?.setOfflineSessionPending(true);
  }, [documentId, ydoc]);

  // Resume an offline editing session after reload (snapshots live in IndexedDB).
  useEffect(() => {
    if (!documentId || !ydoc) return;

    let cancelled = false;
    void (async () => {
      await clearStaleOfflineSnapshots(documentId);
      if (cancelled) return;

      const [baseSnap, mineSnap] = await Promise.all([
        getOfflineBase(documentId),
        getOfflineMine(documentId),
      ]);
      if (
        cancelled ||
        !baseSnap ||
        !mineSnap ||
        baseSnap.state === mineSnap.state
      ) {
        return;
      }

      if (!(await shouldResumeOfflineSession(documentId))) {
        providerRef.current?.setOfflineReviewActive(false);
        await clearOfflineConflictSession();
        return;
      }

      pendingBaseSnapshotRef.current = base64ToUint8(baseSnap.state);
      pendingMineSnapshotRef.current = base64ToUint8(mineSnap.state);
      offlineSessionActiveRef.current = true;
      providerRef.current?.setOfflineSessionPending(true);

      // Arm the review shield only while still offline; reconnect handlers
      // (prevOnlineRef + window "online") call beginOnlineReview().
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        providerRef.current?.setOfflineReviewActive(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearOfflineConflictSession, documentId, ydoc]);

  // React online state (reliable with DevTools offline) + window offline event.
  useEffect(() => {
    if (!documentId || !ydoc) return;

    if (prevOnlineRef.current && !online) {
      snapshotBase();
    }

    if (!prevOnlineRef.current && online && offlineSessionActiveRef.current) {
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
      if (origin === OFFLINE_CONFLICT_RESTORE_ORIGIN || origin === "offline-conflict") return;
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
      if (!offlineSessionActiveRef.current || !ydoc) return;
      const mineBytes = pendingMineSnapshotRef.current;
      if (!mineBytes) return;
      restoreToMineIfNeeded(mineBytes);
      scheduleDetection();
      window.setTimeout(() => {
        void runDetection();
      }, 0);
    };

    window.addEventListener("online", onOnline, { capture: true });
    return () => window.removeEventListener("online", onOnline, { capture: true });
  }, [documentId, restoreToMineIfNeeded, runDetection, scheduleDetection, ydoc]);

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
      if (origin === OFFLINE_CONFLICT_RESTORE_ORIGIN || origin === "offline-conflict") return;
      if (reviewPending || conflicts.length > 0 || conflictReviewArmedRef.current) return;
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
    pendingBroadcastsRef.current = [];
    lastCheckedMergedRef.current = null;
    prevOnlineRef.current = online;
    providerRef.current?.setOfflineReviewActive(false);
    providerRef.current?.setOfflineSessionPending(false);
    offlineSessionActiveRef.current = false;
    mineSnapshotLockedRef.current = false;
    conflictReviewArmedRef.current = false;
    manualConflictResolutionRef.current = false;
    setConflicts([]);
    setClusters([]);
    setReviews([]);
    setReviewPending(false);
  }, [documentId]);

  // Keep the live doc on the frozen mine snapshot for the entire review session.
  useEffect(() => {
    if (!reviewPending || !ydoc) return;
    const mineBytes = pendingMineSnapshotRef.current;
    if (!mineBytes) return;

    const guard = () => {
      if (reviewShieldApplyingRef.current) return;
      if (ydocBodyMatchesSnapshot(ydoc, mineBytes)) return;
      reviewShieldApplyingRef.current = true;
      try {
        syncConflictBlocksToMine(ydoc, mineBytes);
      } finally {
        reviewShieldApplyingRef.current = false;
      }
    };

    guard();
    ydoc.on("update", guard);
    const interval = window.setInterval(guard, 400);
    return () => {
      ydoc.off("update", guard);
      window.clearInterval(interval);
    };
  }, [reviewPending, ydoc]);

  const resolveBlock = useCallback(
    async (
      blockId: string,
      blockIndex: number,
      text: string,
      blockJson?: ProseMirrorJsonNode,
    ): Promise<ProseMirrorJsonNode | null> => {
      const editor = getEditor();
      if (!editor) return null;

      const resolved =
        replaceBlockForConflict(editor, blockId, text, blockJson, blockIndex) ??
        (blockJson?.type && setBlockFromJson(editor, blockId, blockJson, blockIndex)
          ? blockJson
          : setBlockPlainText(editor, blockId, text)
            ? blockJsonFromPlainText(editor, blockId, text, blockIndex)
            : null);

      return resolved;
    },
    [getEditor],
  );

  const broadcastResolvedBlock = useCallback(
    (blockId: string, blockIndex: number, block: ProseMirrorJsonNode) => {
      manualConflictResolutionRef.current = true;
      providerRef.current?.discardDeferredPeerUpdates();
      const payload: BlockResolutionPayload = { blockId, blockIndex, block };
      if (offlineSessionActiveRef.current) {
        pendingBroadcastsRef.current.push(payload);
        return;
      }
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
          payload.blockIndex,
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

  const resolveCluster = useCallback(
    async (clusterId: string, side: SpanConflictVariantSide) => {
      if (side === "base") return;
      const cluster = clusters.find((c) => c.id === clusterId);
      if (!cluster) return;
      const variant = cluster.variants.find((v) => v.side === side);
      if (!variant) return;

      const blockKey = `${cluster.blockId}:${cluster.blockIndex}`;
      const working =
        workingBlockTextRef.current.get(blockKey) ?? cluster.mineText;
      const nextText =
        side === "mine"
          ? cluster.mineText
          : side === "theirs"
            ? cluster.theirsText
            : applyHunkToText(working, variant.hunk);
      const nextBlockJson =
        side === "theirs" ? cluster.theirsBlock : cluster.mineBlock;
      workingBlockTextRef.current.set(blockKey, nextText);

      const block =
        (await resolveBlock(
          cluster.blockId,
          cluster.blockIndex,
          nextText,
          nextBlockJson,
        )) ?? nextBlockJson;

      if ((side === "mine" || side === "theirs") && ydoc) {
        providerRef.current?.runWithoutOutgoingUpdates(() => {
          syncResolvedYDoc(
            ydoc,
            getEditor,
            side,
            pendingMineSnapshotRef.current,
          );
        });
      }

      const nextClusters = clusters.filter((c) => c.id !== clusterId);
      setClusters(nextClusters);

      if (
        !nextClusters.some(
          (c) =>
            c.blockId === cluster.blockId && c.blockIndex === cluster.blockIndex,
        )
      ) {
        if (block) {
          broadcastResolvedBlock(cluster.blockId, cluster.blockIndex, block);
        }
        workingBlockTextRef.current.delete(blockKey);
        setConflicts((prev) =>
          prev.filter(
            (c) =>
              !(
                c.blockId === cluster.blockId &&
                c.blockIndex === cluster.blockIndex
              ),
          ),
        );
        setReviews((prev) =>
          prev.filter((review) => review.blockId !== cluster.blockId),
        );
      }
    },
    [broadcastResolvedBlock, clusters, getEditor, resolveBlock, ydoc],
  );

  const keepMine = useCallback(
    async (blockId: string) => {
      const conflict = conflicts.find((c) => c.blockId === blockId);
      if (!conflict) return;
      const block =
        (await resolveBlock(
          blockId,
          conflict.blockIndex,
          conflict.mineText,
          conflict.mineBlock,
        )) ?? conflict.mineBlock;
      if (ydoc) {
        providerRef.current?.runWithoutOutgoingUpdates(() => {
          syncResolvedYDoc(
            ydoc,
            getEditor,
            "mine",
            pendingMineSnapshotRef.current,
          );
        });
      }
      if (block) {
        broadcastResolvedBlock(blockId, conflict.blockIndex, block);
      }
      setConflicts((prev) => prev.filter((c) => c.blockId !== blockId));
      setClusters((prev) => prev.filter((c) => c.blockId !== blockId));
      setReviews((prev) => prev.filter((review) => review.blockId !== blockId));
    },
    [broadcastResolvedBlock, conflicts, getEditor, resolveBlock, ydoc],
  );

  const takeTheirs = useCallback(
    async (blockId: string) => {
      const conflict = conflicts.find((c) => c.blockId === blockId);
      if (!conflict) return;
      const block =
        (await resolveBlock(
          blockId,
          conflict.blockIndex,
          conflict.theirsText,
          conflict.theirsBlock,
        )) ?? conflict.theirsBlock;
      if (ydoc) {
        providerRef.current?.runWithoutOutgoingUpdates(() => {
          syncResolvedYDoc(ydoc, getEditor, "theirs", null);
        });
      }
      if (block) {
        broadcastResolvedBlock(blockId, conflict.blockIndex, block);
      }
      setConflicts((prev) => prev.filter((c) => c.blockId !== blockId));
      setClusters((prev) => prev.filter((c) => c.blockId !== blockId));
      setReviews((prev) => prev.filter((review) => review.blockId !== blockId));
    },
    [broadcastResolvedBlock, conflicts, getEditor, resolveBlock, ydoc],
  );

  const keepAllMine = useCallback(async () => {
    for (const conflict of conflicts) {
      const block =
        (await resolveBlock(
          conflict.blockId,
          conflict.blockIndex,
          conflict.mineText,
          conflict.mineBlock,
        )) ?? conflict.mineBlock;
      if (block) {
        broadcastResolvedBlock(conflict.blockId, conflict.blockIndex, block);
      }
    }
    if (ydoc) {
      providerRef.current?.runWithoutOutgoingUpdates(() => {
        syncResolvedYDoc(
          ydoc,
          getEditor,
          "mine",
          pendingMineSnapshotRef.current,
        );
      });
    }
    setConflicts([]);
    setClusters([]);
    setReviews([]);
  }, [broadcastResolvedBlock, conflicts, getEditor, resolveBlock, ydoc]);

  const takeAllTheirs = useCallback(async () => {
    for (const conflict of conflicts) {
      const block =
        (await resolveBlock(
          conflict.blockId,
          conflict.blockIndex,
          conflict.theirsText,
          conflict.theirsBlock,
        )) ?? conflict.theirsBlock;
      if (block) {
        broadcastResolvedBlock(conflict.blockId, conflict.blockIndex, block);
      }
    }
    if (ydoc) {
      providerRef.current?.runWithoutOutgoingUpdates(() => {
        syncResolvedYDoc(ydoc, getEditor, "theirs", null);
      });
    }
    setConflicts([]);
    setClusters([]);
    setReviews([]);
  }, [broadcastResolvedBlock, conflicts, getEditor, resolveBlock, ydoc]);

  useEffect(() => {
    if (conflicts.length > 0 || clusters.length > 0 || !reviewPending) return;
    if (!documentId) return;

    void (async () => {
      if (!(await ownsOfflineConflictReview(documentId, TAB_ID))) return;
      providerRef.current?.discardDeferredPeerUpdates();
      await clearOfflineSnapshots(documentId);
      conflictReviewArmedRef.current = false;
      setReviewPending(false);
      pendingBaseSnapshotRef.current = null;
      pendingMineSnapshotRef.current = null;
      lastCheckedMergedRef.current = null;
      endOfflineReview();
      providerRef.current?.resetBroadcastBaseline();
      flushPendingBroadcasts();
      // Block resolution is authoritative — never re-push offline Yjs deltas on top.
      if (!manualConflictResolutionRef.current) {
        providerRef.current?.broadcastPendingLocalUpdates();
      }
      manualConflictResolutionRef.current = false;
      flushPersist();
    })();
  }, [
    clusters.length,
    conflicts.length,
    documentId,
    endOfflineReview,
    flushPendingBroadcasts,
    flushPersist,
    reviewPending,
  ]);

  return {
    offlineConflictBlocks: conflicts,
    offlineConflictClusters: clusters,
    offlineConflictReviews: reviews,
    offlineConflictReviewPending: reviewPending,
    snapshotOfflineBase: snapshotBase,
    keepOfflineMine: keepMine,
    takeOfflineTheirs: takeTheirs,
    keepAllOfflineMine: keepAllMine,
    takeAllOfflineTheirs: takeAllTheirs,
    resolveOfflineCluster: resolveCluster,
  };
}
