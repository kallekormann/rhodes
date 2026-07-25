/**
 * Sync a Y.Doc over Supabase Realtime broadcast (no separate WS server).
 * Protocol: sync step1/step2 + incremental updates + awareness (y-protocols).
 */

import type { RealtimeChannel, RealtimeChannelOptions } from "@supabase/supabase-js";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

type SyncListener = (synced: boolean) => void;
type AuthErrorListener = (failed: boolean) => void;

/** Minimal client surface we need — avoids strict Supabase generic mismatches. */
type RealtimeClient = {
  channel: (name: string, opts?: RealtimeChannelOptions) => RealtimeChannel;
  removeChannel: (channel: RealtimeChannel) => Promise<unknown> | unknown;
};

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isAuthSendError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("jwt") ||
    lower.includes("not authenticated")
  );
}

const EVENT_SYNC = "y-sync";
const EVENT_UPDATE = "y-update";
const EVENT_AWARENESS = "y-awareness";

export type BlockResolutionPayload = {
  blockId: string;
  blockIndex: number;
  block: {
    type?: string;
    attrs?: { blockId?: string | null };
    text?: string;
    content?: BlockResolutionPayload["block"][];
  };
};

type BlockResolutionListener = (payload: BlockResolutionPayload) => void;

export type PeerIdentity = { userId: string; displayName: string };

export type DeferredPeerUpdate = {
  update: Uint8Array;
  clientId: number | null;
  identity?: PeerIdentity;
  /** sync step2 carries whole-room state — never use for per-peer attribution. */
  source?: "sync" | "update";
};

type BroadcastPayload = {
  data?: string;
  clientId?: number;
};

export class SupabaseYjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly documentId: string;

  private channel: RealtimeChannel | null = null;
  private supabase: RealtimeClient;
  private reauth: () => Promise<void>;
  private synced = false;
  private destroyed = false;
  private authFailed = false;
  private reauthInFlight = false;
  private soloSyncTimer: number | null = null;
  private persistTimer: number | null = null;
  private listeners = new Set<SyncListener>();
  private authErrorListeners = new Set<AuthErrorListener>();
  private readonly origin = this;
  private awarenessPruneTimer: number | null = null;
  private awarenessHeartbeatTimer: number | null = null;
  private readonly persist?: (state: Uint8Array) => Promise<void>;
  private readonly persistOnUnload?: (state: Uint8Array) => void;
  private readonly onDisconnected?: () => void;
  /** Doc state peers are believed to have — diff is broadcast after each sync. */
  private unsentBaselineVector: Uint8Array | null;
  private reconnectTimer: number | null = null;
  private soloSyncLongTimer: number | null = null;
  private reconnecting = false;
  private intentionalDisconnect = false;
  /** True once a peer sync/update arrived during the current connect attempt. */
  private receivedPeerDataSinceConnect = false;
  /** Set at connect when offline edits need peer step2 before catch-up is complete. */
  private catchupRequiresPeer = false;
  private soloSyncedWithoutPeer = false;
  private catchupListeners = new Set<SyncListener>();
  /** Hold peer updates during offline conflict review so the editor stays on mine. */
  private deferPeerUpdates = false;
  private deferredPeerUpdates: DeferredPeerUpdate[] = [];
  /** Last known Yjs user per remote client — survives awareness prune. */
  private awarenessUsersByClientId = new Map<number, PeerIdentity>();
  /** Set while the offline returner has an active review session (from go-offline until resolved). */
  private offlineReviewActive = false;
  private peerUpdatesDeferredListener: (() => void) | null = null;
  private blockResolutionListeners = new Set<BlockResolutionListener>();
  /** Suppress rebroadcast while applying a peer's authoritative block resolution. */
  private suppressOutgoingUpdates = false;
  /** Another peer is reviewing offline conflicts — defer their leaked updates and block persist. */
  private remoteConflictReviewActive = false;
  /** Browser reported offline — block outbound sync until back online. */
  private clientNetworkOffline = false;
  /** User went offline with an active editing session (before conflict review arms). */
  private offlineSessionPending = false;
  private reconnectAfterOnlineTimer: number | null = null;

  /** Drop remote carets when a peer stops broadcasting (offline / closed tab). */
  private static readonly AWARENESS_TIMEOUT_MS = 6_000;
  /** Idle window before writing the merged CRDT state durably to Postgres. */
  private static readonly PERSIST_DEBOUNCE_MS = 1_500;

  constructor(params: {
    documentId: string;
    doc: Y.Doc;
    supabase: RealtimeClient;
    reauth: () => Promise<void>;
    /** Debounced durable persistence of the full merged CRDT state. */
    persist?: (state: Uint8Array) => Promise<void>;
    /** Best-effort synchronous persistence on page unload (e.g. sendBeacon). */
    persistOnUnload?: (state: Uint8Array) => void;
    /** Called when the Realtime channel disconnects (sleep, network blip, offline). */
    onDisconnected?: () => void;
    /** Optional baseline for the first post-sync broadcast (e.g. server state vector). */
    unsentBaselineVector?: Uint8Array | null;
  }) {
    this.documentId = params.documentId;
    this.doc = params.doc;
    this.supabase = params.supabase;
    this.reauth = params.reauth;
    this.persist = params.persist;
    this.persistOnUnload = params.persistOnUnload;
    this.onDisconnected = params.onDisconnected;
    this.unsentBaselineVector = params.unsentBaselineVector ?? null;

    this.doc.on("update", this.handleDocUpdate);
    this.doc.on("update", this.schedulePersist);
    this.awareness = new Awareness(this.doc);
    this.awareness.on("update", this.handleAwarenessUpdate);

    void this.connect();
    this.awarenessPruneTimer = window.setInterval(() => {
      this.pruneStaleAwareness();
    }, 1_000);
    this.awarenessHeartbeatTimer = window.setInterval(() => {
      this.heartbeatAwareness();
    }, 2_000);
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.flushPersistOnUnload);
      window.addEventListener("pagehide", this.flushPersistOnUnload);
      window.addEventListener("offline", this.handleBrowserOffline);
      window.addEventListener("online", this.handleBrowserOnline);
    }
  }

  /** Re-subscribe the Realtime channel after network recovery. */
  async reconnect(): Promise<void> {
    if (this.destroyed || this.reconnecting) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.scheduleReconnect();
      return;
    }
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.offlineReviewActive) {
      this.deferPeerUpdates = true;
    }

    this.reconnecting = true;
    try {
      this.intentionalDisconnect = true;
      if (this.channel) {
        await this.supabase.removeChannel(this.channel);
        this.channel = null;
      }
      this.intentionalDisconnect = false;
      this.setSynced(false);
      await this.connect();
    } finally {
      this.reconnecting = false;
    }
  }

  private handleBrowserOffline = () => {
    // Capture before offline edits so peers can receive them after reconnect.
    this.unsentBaselineVector = Y.encodeStateVector(this.doc);
    this.clientNetworkOffline = true;
    if (this.offlineReviewActive || this.offlineSessionPending) {
      this.deferPeerUpdates = true;
    }
    void this.disconnectTransport();
  };

  private handleBrowserOnline = () => {
    this.clientNetworkOffline = false;
    if (this.reconnectAfterOnlineTimer != null) {
      window.clearTimeout(this.reconnectAfterOnlineTimer);
    }
    // Capture-phase conflict listeners arm the review shield first; then reconnect.
    this.reconnectAfterOnlineTimer = window.setTimeout(() => {
      this.reconnectAfterOnlineTimer = null;
      void this.reconnect();
    }, 0);
  };

  /** Called when the user starts an offline editing session (base snapshot taken). */
  setOfflineSessionPending(pending: boolean): void {
    this.offlineSessionPending = pending;
    if (pending) {
      this.deferPeerUpdates = true;
      return;
    }
    if (!this.offlineReviewActive) {
      this.deferPeerUpdates = false;
      this.deferredPeerUpdates = [];
    }
    this.maybeNudgeLocalAwareness();
  }

  get isOfflineSessionPending(): boolean {
    return this.offlineSessionPending;
  }

  private async disconnectTransport(): Promise<void> {
    if (!this.channel) {
      this.setSynced(false);
      return;
    }
    this.intentionalDisconnect = true;
    try {
      // Tell peers to drop our caret, but keep local awareness so we can re-announce
      // after reconnect (CollaborationCursor + user fields stay intact).
      const leaveUpdate = encodeAwarenessUpdate(
        this.awareness,
        [],
        [this.doc.clientID],
      );
      if (leaveUpdate.length > 0) {
        await this.channel.send({
          type: "broadcast",
          event: EVENT_AWARENESS,
          payload: { data: uint8ToBase64(leaveUpdate) },
        });
      }
      await this.supabase.removeChannel(this.channel);
    } catch {
      /* channel may already be gone */
    }
    this.channel = null;
    this.intentionalDisconnect = false;
    this.setSynced(false);
    this.onDisconnected?.();
  }

  private shouldBlockOutboundBroadcast(): boolean {
    return (
      this.offlineReviewActive ||
      this.offlineSessionPending ||
      this.clientNetworkOffline
    );
  }

  get isSynced(): boolean {
    return this.synced;
  }

  /** True once peer data has been merged (or no offline catch-up is pending). */
  get isCatchupComplete(): boolean {
    if (!this.synced) return false;
    if (!this.catchupRequiresPeer) return true;
    return this.receivedPeerDataSinceConnect || this.soloSyncedWithoutPeer;
  }

  get isDeferringPeerUpdates(): boolean {
    return this.deferPeerUpdates;
  }

  get isRemoteConflictReviewActive(): boolean {
    return this.remoteConflictReviewActive;
  }

  private shouldBlockPersist(): boolean {
    // Only the offline returner pauses persist during their own conflict review.
    // Peers must keep persisting — otherwise their edits never reach Postgres.
    return this.offlineReviewActive;
  }

  private shouldDeferIncomingUpdates(): boolean {
    // Only the offline returner defers peer updates during their own review.
    // Never block live edits because another peer has conflictReviewPending.
    return this.deferPeerUpdates;
  }

  setOnPeerUpdatesDeferred(listener: (() => void) | null): void {
    this.peerUpdatesDeferredListener = listener;
  }

  onBlockResolution(listener: BlockResolutionListener): () => void {
    this.blockResolutionListeners.add(listener);
    return () => this.blockResolutionListeners.delete(listener);
  }

  /**
   * No-op: offline convergence is a single CRDT `y-update` commit.
   * Kept for back-compat until callers stop invoking it.
   */
  broadcastBlockResolution(_payload: BlockResolutionPayload): void {
    /* y-block-resolved is no longer authority */
  }

  runWithoutOutgoingUpdates<T>(fn: () => T): T {
    this.suppressOutgoingUpdates = true;
    try {
      return fn();
    } finally {
      this.suppressOutgoingUpdates = false;
    }
  }

  /**
   * Offline returner is reviewing local edits — queue all peer Yjs updates until
   * conflicts are resolved or a clean auto-merge is confirmed.
   */
  setOfflineReviewActive(active: boolean): void {
    this.offlineReviewActive = active;
    this.awareness.setLocalStateField(
      "conflictReviewPending",
      active ? true : null,
    );
    if (active) {
      this.deferPeerUpdates = true;
      return;
    }
    if (!this.remoteConflictReviewActive && !this.offlineSessionPending) {
      this.deferPeerUpdates = false;
      this.deferredPeerUpdates = [];
      this.maybeNudgeLocalAwareness();
    }
  }

  /**
   * While true, peer sync/update messages are queued instead of applied to the live doc.
   */
  setDeferPeerUpdates(defer: boolean): void {
    this.deferPeerUpdates =
      defer || this.offlineReviewActive || this.offlineSessionPending;
  }

  /** Re-broadcast local cursor/presence after reconnect or offline session end. */
  nudgeLocalAwareness(): void {
    if (this.destroyed || this.clientNetworkOffline || !this.channel) return;
    const local = this.awareness.getLocalState();
    if (local == null) return;
    this.awareness.setLocalState({ ...local });
  }

  private maybeNudgeLocalAwareness(): void {
    // Presence must re-announce during offline session / conflict review —
    // only skip when the browser is offline or the channel is gone (handled in nudge).
    this.nudgeLocalAwareness();
  }

  /** Merged state (mine + queued peer updates) for conflict detection only. */
  getDeferredMergedState(): Uint8Array {
    const shadow = new Y.Doc();
    Y.applyUpdate(shadow, Y.encodeStateAsUpdate(this.doc));
    for (const entry of this.deferredPeerUpdates) {
      Y.applyUpdate(shadow, entry.update);
    }
    const merged = Y.encodeStateAsUpdate(shadow);
    shadow.destroy();
    return merged;
  }

  /**
   * Peer document for offline conflict detection: offline base ⊕ deferred updates.
   * Caller owns destroy(). Does not mutate the live doc.
   */
  buildPeerDocFromDeferred(baseSnapshot: {
    state: string;
    capturedAt: string;
  }): Y.Doc {
    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, base64ToUint8(baseSnapshot.state));
    for (const entry of this.deferredPeerUpdates) {
      if (entry.update.length > 0) {
        Y.applyUpdate(peerDoc, entry.update);
      }
    }
    return peerDoc;
  }

  getDeferredPeerUpdates(): DeferredPeerUpdate[] {
    return [...this.deferredPeerUpdates];
  }

  /**
   * Apply queued peer updates to the live doc with provider origin.
   * Unlike releaseDeferredPeerUpdates, runs even while offlineReviewActive
   * (commit absorbs before tearing the review down).
   */
  absorbDeferredPeerUpdates(): void {
    if (this.destroyed) return;
    for (const entry of this.deferredPeerUpdates) {
      Y.applyUpdate(this.doc, entry.update, this.origin);
    }
    this.deferredPeerUpdates = [];
  }

  /**
   * Commit the resolved offline body: clear outbound shields before mutate so
   * handleDocUpdate broadcasts, then flush and re-announce presence.
   */
  commitResolvedDoc(mutate: () => void): void {
    if (this.destroyed) return;
    this.offlineReviewActive = false;
    this.offlineSessionPending = false;
    this.deferPeerUpdates = false;
    this.deferredPeerUpdates = [];
    this.suppressOutgoingUpdates = false;
    this.awareness.setLocalStateField("conflictReviewPending", null);
    mutate();
    this.resetBroadcastBaseline();
    this.broadcastPendingLocalUpdates();
    this.flushPersist();
    this.nudgeLocalAwareness();
  }

  /** Resolve a peer's identity from live awareness or the non-pruned cache. */
  getPeerIdentity(clientId: number): PeerIdentity {
    const resolved = this.resolveAwarenessUser(clientId);
    if (resolved) return resolved;
    return {
      userId: `peer-${clientId}`,
      displayName: "Other editor",
    };
  }

  /** Apply queued peer updates after a clean auto-merge (no conflicts). */
  releaseDeferredPeerUpdates(): void {
    if (this.destroyed || this.offlineReviewActive) return;
    for (const entry of this.deferredPeerUpdates) {
      Y.applyUpdate(this.doc, entry.update, this.origin);
    }
    this.deferredPeerUpdates = [];
    if (!this.offlineReviewActive && !this.offlineSessionPending) {
      this.deferPeerUpdates = false;
    }
  }

  /** Drop queued peer updates once conflicts are resolved manually. */
  discardDeferredPeerUpdates(): void {
    this.deferredPeerUpdates = [];
    if (!this.offlineReviewActive && !this.offlineSessionPending) {
      this.deferPeerUpdates = false;
    }
  }

  private queueDeferredPeerUpdate(
    update: Uint8Array,
    clientId?: number | null,
    source: "sync" | "update" = "update",
  ): void {
    if (update.length === 0) return;
    const identity =
      clientId != null ? this.resolveAwarenessUser(clientId) : undefined;
    this.deferredPeerUpdates.push({
      update,
      clientId: clientId ?? null,
      identity,
      source,
    });
    this.markPeerDataReceived();
    this.setSynced(true);
    this.peerUpdatesDeferredListener?.();
  }

  onCatchupComplete(listener: SyncListener): () => void {
    this.catchupListeners.add(listener);
    if (this.isCatchupComplete) listener(true);
    return () => this.catchupListeners.delete(listener);
  }

  private hasPendingLocalBroadcast(): boolean {
    if (!this.unsentBaselineVector) return false;
    return (
      Y.encodeStateAsUpdate(this.doc, this.unsentBaselineVector).length > 0
    );
  }

  private notifyCatchupIfReady() {
    if (!this.isCatchupComplete) return;
    for (const listener of this.catchupListeners) {
      try {
        listener(true);
      } catch {
        /* ignore */
      }
    }
  }

  private markPeerDataReceived() {
    this.receivedPeerDataSinceConnect = true;
    this.notifyCatchupIfReady();
  }

  /** Immediately persist the current Y.Doc state (bypasses debounce). */
  flushPersist(): void {
    if (this.destroyed || !this.persist || this.shouldBlockPersist()) return;
    if (this.persistTimer != null) {
      window.clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    void this.persist(Y.encodeStateAsUpdate(this.doc)).catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[yjs] flushPersist failed:", error);
      }
    });
  }

  onSynced(listener: SyncListener): () => void {
    this.listeners.add(listener);
    if (this.synced) listener(true);
    return () => this.listeners.delete(listener);
  }

  onAuthError(listener: AuthErrorListener): () => void {
    this.authErrorListeners.add(listener);
    if (this.authFailed) listener(true);
    return () => this.authErrorListeners.delete(listener);
  }

  destroy(): void {
    if (this.destroyed) return;

    // Broadcast leave while the channel is still open so peers drop our caret.
    try {
      removeAwarenessStates(this.awareness, [this.doc.clientID], "local");
    } catch {
      /* awareness may already be gone */
    }

    this.destroyed = true;
    if (this.awarenessPruneTimer != null) {
      window.clearInterval(this.awarenessPruneTimer);
      this.awarenessPruneTimer = null;
    }
    if (this.awarenessHeartbeatTimer != null) {
      window.clearInterval(this.awarenessHeartbeatTimer);
      this.awarenessHeartbeatTimer = null;
    }
    if (this.soloSyncTimer != null) {
      window.clearTimeout(this.soloSyncTimer);
      this.soloSyncTimer = null;
    }
    if (this.soloSyncLongTimer != null) {
      window.clearTimeout(this.soloSyncLongTimer);
      this.soloSyncLongTimer = null;
    }
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.reconnectAfterOnlineTimer != null) {
      window.clearTimeout(this.reconnectAfterOnlineTimer);
      this.reconnectAfterOnlineTimer = null;
    }
    if (this.persistTimer != null) {
      window.clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.flushPersistOnUnload);
      window.removeEventListener("pagehide", this.flushPersistOnUnload);
      window.removeEventListener("offline", this.handleBrowserOffline);
      window.removeEventListener("online", this.handleBrowserOnline);
    }
    this.flushPersistOnUnload();
    this.doc.off("update", this.handleDocUpdate);
    this.doc.off("update", this.schedulePersist);
    this.awareness.off("update", this.handleAwarenessUpdate);
    if (this.channel) {
      void this.supabase.removeChannel(this.channel);
    }
    this.channel = null;
    this.awareness.destroy();
    this.listeners.clear();
    this.catchupListeners.clear();
    this.authErrorListeners.clear();
    this.blockResolutionListeners.clear();
  }

  private setAuthFailed(next: boolean) {
    if (this.authFailed === next) return;
    this.authFailed = next;
    for (const listener of this.authErrorListeners) {
      try {
        listener(next);
      } catch {
        /* ignore */
      }
    }
  }

  private heartbeatAwareness() {
    if (this.destroyed || this.clientNetworkOffline || !this.channel) return;
    const local = this.awareness.getLocalState();
    if (!local) return;
    // Re-set so lastUpdated stays fresh for peer prune timers.
    this.awareness.setLocalState(local);
  }

  private pruneStaleAwareness() {
    if (this.destroyed) return;
    const now = Date.now();
    const stale: number[] = [];
    this.awareness.getStates().forEach((_state, clientId) => {
      if (clientId === this.doc.clientID) return;
      const meta = (
        this.awareness as Awareness & {
          meta: Map<number, { lastUpdated: number }>;
        }
      ).meta.get(clientId);
      if (!meta) return;
      if (now - meta.lastUpdated > SupabaseYjsProvider.AWARENESS_TIMEOUT_MS) {
        stale.push(clientId);
      }
    });
    if (stale.length > 0) {
      removeAwarenessStates(this.awareness, stale, "timeout");
    }
  }

  private setSynced(next: boolean) {
    const wasSynced = this.synced;
    if (this.synced === next) return;
    this.synced = next;
    if (next && !wasSynced && !this.shouldBlockOutboundBroadcast()) {
      void this.broadcastPendingLocalUpdates();
    }
    for (const listener of this.listeners) {
      try {
        listener(next);
      } catch {
        /* ignore */
      }
    }
    if (next) {
      this.notifyCatchupIfReady();
    }
  }

  /**
   * After the initial sync handshake, broadcast updates that accumulated locally
   * before the provider connected (e.g. offline edits). The step1/step2 exchange
   * only pulls remote changes into this client — it does not push local ops out.
   */
  /** Push offline edits to peers after conflict review completes. */
  broadcastPendingLocalUpdates(): void {
    void this.broadcastPendingLocalUpdatesInternal();
  }

  /** Align broadcast baseline with the current doc (e.g. after conflict resolution). */
  resetBroadcastBaseline(): void {
    this.unsentBaselineVector = Y.encodeStateVector(this.doc);
  }

  private async broadcastPendingLocalUpdatesInternal() {
    if (this.destroyed || this.shouldBlockOutboundBroadcast()) return;

    const update = this.unsentBaselineVector
      ? Y.encodeStateAsUpdate(this.doc, this.unsentBaselineVector)
      : Y.encodeStateAsUpdate(this.doc);

    // Advance baseline to current doc so we only push each op once.
    this.unsentBaselineVector = Y.encodeStateVector(this.doc);

    if (update.length > 0) {
      await this.send(EVENT_UPDATE, update);
    }
  }

  private schedulePersist = () => {
    if (this.destroyed || !this.persist || this.shouldBlockPersist()) return;
    if (this.persistTimer != null) {
      window.clearTimeout(this.persistTimer);
    }
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      if (this.shouldBlockPersist()) return;
      void this.persist?.(Y.encodeStateAsUpdate(this.doc)).catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[yjs] debounced persist failed:", error);
        }
      });
    }, SupabaseYjsProvider.PERSIST_DEBOUNCE_MS);
  };

  private flushPersistOnUnload = () => {
    if (this.destroyed || this.shouldBlockPersist()) return;
    this.persistOnUnload?.(Y.encodeStateAsUpdate(this.doc));
  };

  /** Scan peer awareness for an active offline conflict review session. */
  private refreshRemoteConflictReview(): void {
    let pending = false;
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.doc.clientID) return;
      if (
        state &&
        (state as { conflictReviewPending?: boolean }).conflictReviewPending
      ) {
        pending = true;
      }
    });

    const wasActive = this.remoteConflictReviewActive;
    this.remoteConflictReviewActive = pending;

    if (pending && !wasActive) {
      return;
    }

    if (!pending && wasActive) {
      this.deferredPeerUpdates = [];
      if (!this.offlineReviewActive) {
        this.deferPeerUpdates = false;
      }
    }
  }

  private scheduleSoloSyncFallback() {
    if (this.soloSyncTimer != null) {
      window.clearTimeout(this.soloSyncTimer);
    }
    if (this.soloSyncLongTimer != null) {
      window.clearTimeout(this.soloSyncLongTimer);
      this.soloSyncLongTimer = null;
    }

    // When offline edits are pending, wait for a peer step2 instead of solo-syncing early.
    if (this.hasPendingLocalBroadcast()) {
    this.soloSyncLongTimer = window.setTimeout(() => {
      this.soloSyncLongTimer = null;
      if (!this.destroyed && !this.authFailed && !this.synced) {
        this.soloSyncedWithoutPeer = true;
        this.setSynced(true);
      }
    }, 5_000);
      return;
    }

    this.soloSyncTimer = window.setTimeout(() => {
      this.soloSyncTimer = null;
      if (!this.destroyed && !this.authFailed) {
        this.setSynced(true);
      }
    }, 600);
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer != null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, 1_000);
  }

  private async connect() {
    if (this.destroyed) return;

    this.receivedPeerDataSinceConnect = false;
    this.soloSyncedWithoutPeer = false;
    this.catchupRequiresPeer =
      this.hasPendingLocalBroadcast() ||
      this.offlineReviewActive ||
      this.offlineSessionPending;

    // Only the offline conflict returner queues peer updates — never block
    // passive viewers or catch-up from receiving live edits.
    this.deferPeerUpdates =
      this.offlineReviewActive || this.offlineSessionPending;
    if (!this.offlineReviewActive && !this.offlineSessionPending) {
      this.deferredPeerUpdates = [];
    }

    // First connect only: baseline is current doc (usually empty diff after sync).
    if (!this.unsentBaselineVector) {
      this.unsentBaselineVector = Y.encodeStateVector(this.doc);
    }

    const channel = this.supabase.channel(`ydoc:${this.documentId}`, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });
    this.channel = channel;

    channel.on("broadcast", { event: EVENT_SYNC }, ({ payload }) => {
      this.applyEncodedMessage(payload as BroadcastPayload);
    });
    channel.on("broadcast", { event: EVENT_UPDATE }, ({ payload }) => {
      this.applyEncodedUpdate(payload as BroadcastPayload);
    });
    channel.on("broadcast", { event: EVENT_AWARENESS }, ({ payload }) => {
      this.applyEncodedAwareness(payload as BroadcastPayload);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !this.destroyed) {
        void this.sendSyncStep1();
        this.scheduleSoloSyncFallback();
        this.maybeNudgeLocalAwareness();
        return;
      }
      if (
        (status === "CLOSED" || status === "CHANNEL_ERROR") &&
        !this.destroyed &&
        !this.intentionalDisconnect &&
        !this.reconnecting
      ) {
        if (!this.unsentBaselineVector) {
          this.unsentBaselineVector = Y.encodeStateVector(this.doc);
        }
        this.setSynced(false);
        this.onDisconnected?.();
        this.scheduleReconnect();
      }
    });
  }

  private async resubscribeAfterReauth() {
    if (this.destroyed || this.reauthInFlight) return;
    this.reauthInFlight = true;
    try {
      await this.reauth();
      this.setAuthFailed(false);
      if (this.channel) {
        await this.supabase.removeChannel(this.channel);
      }
      this.channel = null;
      this.setSynced(false);
      await this.connect();
    } catch {
      this.setAuthFailed(true);
    } finally {
      this.reauthInFlight = false;
    }
  }

  private async send(event: string, bytes: Uint8Array) {
    if (!this.channel || this.destroyed || this.clientNetworkOffline) return;

    const payload = {
      type: "broadcast" as const,
      event,
      payload: {
        data: uint8ToBase64(bytes),
        clientId: this.doc.clientID,
      },
    };

    try {
      const result = await this.channel.send(payload);
      const status =
        typeof result === "object" && result !== null && "status" in result
          ? String((result as { status?: unknown }).status ?? "")
          : "";
      if (status === "error") {
        const error =
          typeof result === "object" && result !== null && "error" in result
            ? (result as { error?: unknown }).error
            : result;
        if (isAuthSendError(error)) {
          this.setAuthFailed(true);
          await this.resubscribeAfterReauth();
        }
      } else if (this.authFailed) {
        this.setAuthFailed(false);
      }
    } catch (error) {
      if (isAuthSendError(error)) {
        this.setAuthFailed(true);
        await this.resubscribeAfterReauth();
      }
    }
  }

  private async sendSyncStep1() {
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, this.doc);
    await this.send(EVENT_SYNC, encoding.toUint8Array(encoder));
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (
      origin === this.origin ||
      this.destroyed ||
      this.offlineReviewActive ||
      this.clientNetworkOffline ||
      this.suppressOutgoingUpdates
    ) {
      return;
    }
    void this.send(EVENT_UPDATE, update);
    if (update.length > 8_192) {
      this.flushPersist();
    }
  };

  private captureAwarenessUsers = () => {
    if (this.destroyed) return;
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.doc.clientID) return;
      const user = state?.user as { id?: string; name?: string } | undefined;
      const userId = user?.id?.trim();
      if (!userId) return;
      const displayName = user?.name?.trim() || "";
      this.awarenessUsersByClientId.set(clientId, { userId, displayName });
    });
  };

  private resolveAwarenessUser(clientId: number): PeerIdentity | undefined {
    const state = this.awareness.getStates().get(clientId);
    const liveUser = state?.user as { id?: string; name?: string } | undefined;
    const liveUserId = liveUser?.id?.trim();
    if (liveUserId) {
      const displayName = liveUser?.name?.trim() || "";
      const identity = { userId: liveUserId, displayName };
      this.awarenessUsersByClientId.set(clientId, identity);
      return identity;
    }
    return this.awarenessUsersByClientId.get(clientId);
  }

  private handleAwarenessUpdate = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    // Ignore remote-applied updates; still allow local leave during destroy.
    if (origin === this.origin) return;
    if (this.destroyed && origin !== "local") return;
    if (this.clientNetworkOffline) return;
    const changed = added.concat(updated, removed);
    if (changed.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, changed);
    void this.send(EVENT_AWARENESS, update);
  };

  private applyEncodedMessage(payload: BroadcastPayload) {
    if (!payload?.data || this.destroyed) return;
    const bytes = base64ToUint8(payload.data);

    if (this.shouldDeferIncomingUpdates()) {
      const decoder = decoding.createDecoder(bytes);
      const encoder = encoding.createEncoder();
      const shadow = new Y.Doc();
      Y.applyUpdate(shadow, Y.encodeStateAsUpdate(this.doc));

      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        shadow,
        this.origin,
      );

      // Do not push offline returner's local deltas to peers during review.
      if (encoding.length(encoder) > 1 && !this.offlineReviewActive) {
        void this.send(EVENT_SYNC, encoding.toUint8Array(encoder));
      }

      if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
        const peerDelta = Y.encodeStateAsUpdate(
          shadow,
          Y.encodeStateVector(this.doc),
        );
        this.queueDeferredPeerUpdate(peerDelta, payload.clientId, "sync");
      }

      shadow.destroy();
      return;
    }

    const decoder = decoding.createDecoder(bytes);
    const encoder = encoding.createEncoder();
    const syncMessageType = syncProtocol.readSyncMessage(
      decoder,
      encoder,
      this.doc,
      this.origin,
    );
    if (encoding.length(encoder) > 1) {
      void this.send(EVENT_SYNC, encoding.toUint8Array(encoder));
    }
    if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
      this.markPeerDataReceived();
      this.setSynced(true);
    }
    // Step1 is only a state-vector handshake — peer content arrives in step2/update.
  }

  private applyEncodedUpdate(payload: BroadcastPayload) {
    if (!payload?.data || this.destroyed) return;
    const update = base64ToUint8(payload.data);
    if (this.shouldDeferIncomingUpdates()) {
      this.queueDeferredPeerUpdate(update, payload.clientId, "update");
      return;
    }
    this.markPeerDataReceived();
    Y.applyUpdate(this.doc, update, this.origin);
    this.setSynced(true);
  }

  private applyEncodedAwareness(payload: BroadcastPayload) {
    if (!payload?.data || this.destroyed) return;
    applyAwarenessUpdate(
      this.awareness,
      base64ToUint8(payload.data),
      this.origin,
    );
    this.captureAwarenessUsers();
    this.refreshRemoteConflictReview();
  }
}
