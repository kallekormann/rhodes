"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import * as Y from "yjs";
import {
  type BlockConflict,
  detectOfflineBlockConflicts,
  isOfflineMergeSettled,
  offlineSessionHasOnlyLocalEdits,
} from "@/lib/offline/yjs-offline-divergence";
import {
  buildBlockReviewModels,
  type BlockReviewModel,
} from "@/lib/offline/base-aligned-review";
import {
  peerContributorSummary,
  peerEditContributorsForBlock,
} from "@/lib/offline/peer-edit-contributions";
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
import {
  buildResolvedBlockPlan,
  decisionKey,
  OFFLINE_CONFLICT_COMMIT_ORIGIN,
  type ConflictDecision,
} from "@/lib/offline/offline-conflict-commit";
import {
  OFFLINE_CONFLICT_RESTORE_ORIGIN,
  patchYDocBodyToResolvedBlocks,
  patchYDocBodyToSnapshot,
  ydocBodyMatchesSnapshot,
} from "@/lib/offline/yjs-offline-restore";
import {
  base64ToUint8,
  uint8ToBase64,
} from "@/lib/collaboration/supabase-yjs-provider";
import type { SupabaseYjsProvider } from "@/lib/collaboration/supabase-yjs-provider";

// Both of these re-assert the offline user's "mine" snapshot while a review
// is pending. They run on essentially every incoming peer/awareness message,
// so they must patch only the blocks that diverged rather than deleting and
// re-cloning the entire fragment every time (see patchYDocBodyToSnapshot).
function syncConflictBlocksToMine(ydoc: Y.Doc, mineBytes: Uint8Array): void {
  patchYDocBodyToSnapshot(ydoc, mineBytes, OFFLINE_CONFLICT_RESTORE_ORIGIN);
}

function restoreToMineSnapshot(ydoc: Y.Doc, mineSnapshot: Uint8Array): void {
  patchYDocBodyToSnapshot(ydoc, mineSnapshot, OFFLINE_CONFLICT_RESTORE_ORIGIN);
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
  const decisionsRef = useRef<Map<string, ConflictDecision>>(new Map());
  const pendingBaseSnapshotRef = useRef<Uint8Array | null>(null);
  const pendingMineSnapshotRef = useRef<Uint8Array | null>(null);
  const reviewBaseSnapshotRef = useRef<{
    state: string;
    capturedAt: string;
  } | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const lastCheckedMergedRef = useRef<string | null>(null);
  const prevOnlineRef = useRef(online);
  const offlineSessionActiveRef = useRef(false);
  const mineSnapshotLockedRef = useRef(false);
  const conflictReviewArmedRef = useRef(false);
  const reviewShieldApplyingRef = useRef(false);
  const committingRef = useRef(false);
  const remoteUpdateOriginRef = useRef(remoteUpdateOrigin);
  remoteUpdateOriginRef.current = remoteUpdateOrigin;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const hasOfflineSession = useCallback(() => {
    return (
      offlineSessionActiveRef.current && pendingBaseSnapshotRef.current != null
    );
  }, []);

  /** Atomic teardown of conflict UI + session flags (Requirement D). */
  const endConflictReviewSession = useCallback(
    async (_reason: string) => {
      committingRef.current = false;
      conflictReviewArmedRef.current = false;
      mineSnapshotLockedRef.current = false;
      offlineSessionActiveRef.current = false;
      workingBlockTextRef.current = new Map();
      decisionsRef.current = new Map();
      reviewBaseSnapshotRef.current = null;
      pendingBaseSnapshotRef.current = null;
      pendingMineSnapshotRef.current = null;
      lastCheckedMergedRef.current = null;
      setReviewPending(false);
      setConflicts([]);
      setClusters([]);
      setReviews([]);
      providerRef.current?.setOfflineReviewActive(false);
      providerRef.current?.setOfflineSessionPending(false);
      if (documentId) {
        await clearOfflineSnapshots(documentId);
        await resetOfflineConflictClaim(documentId);
      }
    },
    [documentId],
  );

  const clearOfflineConflictSession = useCallback(async () => {
    await endConflictReviewSession("clear-session");
  }, [endConflictReviewSession]);

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

  const commitResolvedConflicts = useCallback(async () => {
    if (committingRef.current) return;
    if (!documentId || !ydoc) return;
    if (!(await ownsOfflineConflictReview(documentId, TAB_ID))) {
      await endConflictReviewSession("non-owner");
      return;
    }

    committingRef.current = true;
    const baseSnapshot = reviewBaseSnapshotRef.current;
    const mineBytes = pendingMineSnapshotRef.current;
    const decisions = new Map(decisionsRef.current);

    // Kill shield + decorations before mutate (Phase 1 / Requirement D).
    setReviewPending(false);
    setConflicts([]);
    setClusters([]);
    setReviews([]);
    conflictReviewArmedRef.current = false;
    mineSnapshotLockedRef.current = false;
    workingBlockTextRef.current = new Map();

    if (!baseSnapshot || !mineBytes) {
      await endConflictReviewSession("commit-missing-state");
      return;
    }

    const baseDoc = offlineSnapshotToDoc(baseSnapshot);
    const mineDoc = offlineSnapshotToDoc(toSnapshot(mineBytes));
    const peerDoc =
      providerRef.current?.buildPeerDocFromDeferred(baseSnapshot) ??
      offlineSnapshotToDoc(baseSnapshot);

    try {
      const blockPlan = buildResolvedBlockPlan({
        baseDoc,
        mineDoc,
        peerDoc,
        decisions,
      });

      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug(
          "[offline-patch] commit sides",
          JSON.stringify({
            decisions: Array.from(decisions.entries()),
            plan: blockPlan.map((entry) => ({
              blockId: entry.blockId,
              side: entry.side,
              xmlPreview: entry.xml.toString().slice(0, 120),
            })),
            baseCapturedAt: baseSnapshot.capturedAt,
          }),
        );
      }

      // Body patch already encodes peer decisions. Clearing deferred happens
      // inside commitResolvedDoc after outbound shields drop.
      providerRef.current?.commitResolvedDoc(() => {
        patchYDocBodyToResolvedBlocks(
          ydoc,
          blockPlan,
          OFFLINE_CONFLICT_COMMIT_ORIGIN,
        );
      });
      flushPersist();
      await endConflictReviewSession("committed");
    } finally {
      baseDoc.destroy();
      mineDoc.destroy();
      peerDoc.destroy();
      committingRef.current = false;
    }
  }, [documentId, endConflictReviewSession, flushPersist, ydoc]);

  /**
   * A peer's disambiguating `lastLocalEditAt` awareness field can arrive up to
   * one heartbeat cycle (2s) after their edit content lands via sync — well
   * after the 50ms detection debounce below. Keep this pure/reusable so both
   * the initial detection pass and the reactive re-attribution effect below
   * stay in sync.
   */
  const computeContributorsForConflicts = useCallback(
    (
      conflictsList: BlockConflict[],
      baseSnapshot: { state: string; capturedAt: string },
    ) => {
      const peerContributorsByBlock = new Map<
        string,
        ReturnType<typeof peerEditContributorsForBlock>
      >();
      const authorByBlock = new Map<string, string>();

      const awareness = providerRef.current?.awareness;
      if (!awareness) return { peerContributorsByBlock, authorByBlock };

      const deferredUpdates =
        providerRef.current?.getDeferredPeerUpdates() ?? [];
      for (const conflict of conflictsList) {
        const contributors = peerEditContributorsForBlock({
          baseSnapshot,
          deferredUpdates,
          awareness,
          localClientId: ydoc?.clientID,
          blockId: conflict.blockId,
          blockIndex: conflict.blockIndex,
          getPeerIdentity: (clientId) =>
            providerRef.current?.getPeerIdentity(clientId) ?? {
              userId: `peer-${clientId}`,
              displayName: "Other editor",
            },
        });
        peerContributorsByBlock.set(conflict.blockId, contributors);
        authorByBlock.set(
          conflict.blockId,
          peerContributorSummary(contributors),
        );
      }
      return { peerContributorsByBlock, authorByBlock };
    },
    [ydoc],
  );

  const runDetection = useCallback(async () => {
    if (!documentId || !ydoc || !online || !synced) return;
    if (!offlineSessionActiveRef.current) return;
    if (committingRef.current) return;
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

    if (uint8ToBase64(mineBytes) === uint8ToBase64(baseBytes)) {
      await clearOfflineConflictSession();
      return;
    }

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
    const peerDoc =
      providerRef.current?.buildPeerDocFromDeferred(baseSnapshot) ??
      offlineSnapshotToDoc(baseSnapshot);

    const found = detectOfflineBlockConflicts(
      baseDoc,
      mineDoc,
      peerDoc,
      mergedDoc,
      { catchupComplete },
    );

    const settled = isOfflineMergeSettled(
      baseDoc,
      mineDoc,
      peerDoc,
      mergedDoc,
    );
    const onlyLocal = offlineSessionHasOnlyLocalEdits(
      baseDoc,
      mineDoc,
      peerDoc,
    );

    if (found.length > 0) {
      conflictReviewArmedRef.current = true;
      armOfflineReviewShield(mineBytes);
      syncConflictBlocksToMine(ydoc, mineBytes);
      reviewBaseSnapshotRef.current = baseSnapshot;
      decisionsRef.current = new Map();

      const { peerContributorsByBlock, authorByBlock } =
        computeContributorsForConflicts(found, baseSnapshot);

      const nextClusters = clustersFromBlockConflicts(found, authorByBlock);
      const nextReviews = buildBlockReviewModels(
        found,
        nextClusters,
        peerContributorsByBlock,
      );
      workingBlockTextRef.current = new Map(
        found.map((c) => [`${c.blockId}:${c.blockIndex}`, c.mineText]),
      );
      setConflicts(found);
      setClusters(nextClusters);
      setReviews(nextReviews);
      setReviewPending(true);

      baseDoc.destroy();
      mineDoc.destroy();
      mergedDoc.destroy();
      peerDoc.destroy();
      return;
    }

    baseDoc.destroy();
    mineDoc.destroy();
    mergedDoc.destroy();
    peerDoc.destroy();

    // Auto-merge: no Case C, and settled or only-local (S1/S2/S6/S13).
    if (!conflictReviewArmedRef.current && (settled || onlyLocal)) {
      providerRef.current?.setOfflineReviewActive(false);
      providerRef.current?.setOfflineSessionPending(false);
      providerRef.current?.releaseDeferredPeerUpdates();
      await clearOfflineSnapshots(documentId);
      pendingBaseSnapshotRef.current = null;
      pendingMineSnapshotRef.current = null;
      lastCheckedMergedRef.current = null;
      offlineSessionActiveRef.current = false;
      mineSnapshotLockedRef.current = false;
      setConflicts([]);
      setClusters([]);
      setReviews([]);
      setReviewPending(false);
      providerRef.current?.resetBroadcastBaseline();
      providerRef.current?.broadcastPendingLocalUpdates();
      providerRef.current?.nudgeLocalAwareness();
      flushPersist();
    }
  }, [
    armOfflineReviewShield,
    catchupComplete,
    clearOfflineConflictSession,
    computeContributorsForConflicts,
    conflicts.length,
    documentId,
    flushPersist,
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

  // Re-attribute conflicting parties as peer awareness catches up. The initial
  // detection pass runs ~50ms after reconnect, but a peer's disambiguating
  // lastLocalEditAt only reaches us via their next heartbeat (up to 2s later)
  // — without this, attribution permanently freezes on its first (often
  // ambiguous) result and the real name never appears.
  useEffect(() => {
    if (!reviewPending || conflicts.length === 0) return;
    const baseSnapshot = reviewBaseSnapshotRef.current;
    const awareness = providerRef.current?.awareness;
    if (!baseSnapshot || !awareness) return;

    let debounceTimer: number | null = null;

    const recompute = () => {
      const currentConflicts = conflicts;
      if (currentConflicts.length === 0) return;
      const { peerContributorsByBlock, authorByBlock } =
        computeContributorsForConflicts(currentConflicts, baseSnapshot);
      const nextClusters = clustersFromBlockConflicts(
        currentConflicts,
        authorByBlock,
      );
      const nextReviews = buildBlockReviewModels(
        currentConflicts,
        nextClusters,
        peerContributorsByBlock,
      );
      setClusters(nextClusters);
      setReviews(nextReviews);
    };

    const onAwarenessUpdate = () => {
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        recompute();
      }, 150);
    };

    awareness.on("update", onAwarenessUpdate);
    // Covers disambiguating data that already arrived between initial
    // detection and this effect mounting.
    onAwarenessUpdate();

    return () => {
      awareness.off("update", onAwarenessUpdate);
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
    };
  }, [computeContributorsForConflicts, conflicts, reviewPending]);

  const beginOnlineReview = useCallback(() => {
    if (!ydoc || !documentId) return;

    mineSnapshotLockedRef.current = true;

    const startMergeCheck = (mineBytes: Uint8Array) => {
      restoreToMineIfNeeded(mineBytes);
      scheduleDetection();
      window.setTimeout(() => {
        void runDetection();
      }, 0);
    };

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

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        providerRef.current?.setOfflineReviewActive(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearOfflineConflictSession, documentId, ydoc]);

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
      if (!offlineSessionActiveRef.current || mineSnapshotLockedRef.current) {
        return;
      }
      if (!pendingBaseSnapshotRef.current) return;
      if (
        origin === OFFLINE_CONFLICT_RESTORE_ORIGIN ||
        origin === OFFLINE_CONFLICT_COMMIT_ORIGIN ||
        origin === "offline-conflict"
      ) {
        return;
      }
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
    return () =>
      window.removeEventListener("online", onOnline, { capture: true });
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
  }, [
    catchupComplete,
    documentId,
    hasOfflineSession,
    online,
    scheduleDetection,
    synced,
    ydoc,
  ]);

  useEffect(() => {
    if (!documentId || !ydoc || !online) return;
    if (!hasOfflineSession()) return;

    const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (
        origin === OFFLINE_CONFLICT_RESTORE_ORIGIN ||
        origin === OFFLINE_CONFLICT_COMMIT_ORIGIN ||
        origin === "offline-conflict"
      ) {
        return;
      }
      if (
        reviewPending ||
        conflicts.length > 0 ||
        conflictReviewArmedRef.current ||
        committingRef.current
      ) {
        return;
      }
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
    decisionsRef.current = new Map();
    reviewBaseSnapshotRef.current = null;
    lastCheckedMergedRef.current = null;
    prevOnlineRef.current = online;
    providerRef.current?.setOfflineReviewActive(false);
    providerRef.current?.setOfflineSessionPending(false);
    offlineSessionActiveRef.current = false;
    mineSnapshotLockedRef.current = false;
    conflictReviewArmedRef.current = false;
    committingRef.current = false;
    setConflicts([]);
    setClusters([]);
    setReviews([]);
    setReviewPending(false);
  }, [documentId]);

  // Mine shield for the entire review session — stops the instant reviewPending clears.
  useEffect(() => {
    if (!reviewPending || !ydoc) return;
    const mineBytes = pendingMineSnapshotRef.current;
    if (!mineBytes) return;

    const guard = () => {
      if (reviewShieldApplyingRef.current) return;
      if (committingRef.current) return;
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

  const recordDecision = useCallback(
    (blockId: string, blockIndex: number, side: "mine" | "theirs") => {
      decisionsRef.current.set(decisionKey(blockId, blockIndex), { side });
      workingBlockTextRef.current.delete(`${blockId}:${blockIndex}`);
      setConflicts((prev) =>
        prev.filter(
          (c) => !(c.blockId === blockId && c.blockIndex === blockIndex),
        ),
      );
      setClusters((prev) =>
        prev.filter(
          (c) => !(c.blockId === blockId && c.blockIndex === blockIndex),
        ),
      );
      setReviews((prev) => prev.filter((review) => review.blockId !== blockId));
    },
    [],
  );

  const resolveCluster = useCallback(
    async (clusterId: string, side: SpanConflictVariantSide) => {
      if (side !== "mine" && side !== "theirs") return;
      const cluster = clusters.find((c) => c.id === clusterId);
      if (!cluster) return;
      recordDecision(cluster.blockId, cluster.blockIndex, side);
    },
    [clusters, recordDecision],
  );

  const keepMine = useCallback(
    async (blockId: string) => {
      const conflict = conflicts.find((c) => c.blockId === blockId);
      if (!conflict) return;
      recordDecision(blockId, conflict.blockIndex, "mine");
    },
    [conflicts, recordDecision],
  );

  const takeTheirs = useCallback(
    async (blockId: string) => {
      const conflict = conflicts.find((c) => c.blockId === blockId);
      if (!conflict) return;
      recordDecision(blockId, conflict.blockIndex, "theirs");
    },
    [conflicts, recordDecision],
  );

  const keepAllMine = useCallback(async () => {
    for (const conflict of conflicts) {
      decisionsRef.current.set(
        decisionKey(conflict.blockId, conflict.blockIndex),
        { side: "mine" },
      );
    }
    setConflicts([]);
    setClusters([]);
    setReviews([]);
  }, [conflicts]);

  const takeAllTheirs = useCallback(async () => {
    for (const conflict of conflicts) {
      decisionsRef.current.set(
        decisionKey(conflict.blockId, conflict.blockIndex),
        { side: "theirs" },
      );
    }
    setConflicts([]);
    setClusters([]);
    setReviews([]);
  }, [conflicts]);

  // When all clusters decided and review still pending → single commit.
  useEffect(() => {
    if (conflicts.length > 0 || clusters.length > 0 || !reviewPending) return;
    if (committingRef.current) return;
    void commitResolvedConflicts();
  }, [
    clusters.length,
    commitResolvedConflicts,
    conflicts.length,
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
