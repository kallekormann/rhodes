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

  /** Drop remote carets when a peer stops broadcasting (offline / closed tab). */
  private static readonly AWARENESS_TIMEOUT_MS = 6_000;
  /** Idle window before writing the merged CRDT state durably to Postgres. */
  private static readonly PERSIST_DEBOUNCE_MS = 4_000;

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
  };

  private handleBrowserOnline = () => {
    void this.reconnect();
  };

  get isSynced(): boolean {
    return this.synced;
  }

  /** True once peer data has been merged (or no offline catch-up is pending). */
  get isCatchupComplete(): boolean {
    if (!this.synced) return false;
    if (!this.catchupRequiresPeer) return true;
    return this.receivedPeerDataSinceConnect || this.soloSyncedWithoutPeer;
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
    if (this.destroyed || !this.persist) return;
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
    if (this.destroyed) return;
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
    if (next && !wasSynced) {
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
  private async broadcastPendingLocalUpdates() {
    if (this.destroyed) return;

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
    if (this.destroyed || !this.persist) return;
    if (this.persistTimer != null) {
      window.clearTimeout(this.persistTimer);
    }
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      void this.persist?.(Y.encodeStateAsUpdate(this.doc)).catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[yjs] debounced persist failed:", error);
        }
      });
    }, SupabaseYjsProvider.PERSIST_DEBOUNCE_MS);
  };

  private flushPersistOnUnload = () => {
    this.persistOnUnload?.(Y.encodeStateAsUpdate(this.doc));
  };

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
    this.catchupRequiresPeer = this.hasPendingLocalBroadcast();

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
      this.applyEncodedMessage(payload as { data?: string });
    });
    channel.on("broadcast", { event: EVENT_UPDATE }, ({ payload }) => {
      this.applyEncodedUpdate(payload as { data?: string });
    });
    channel.on("broadcast", { event: EVENT_AWARENESS }, ({ payload }) => {
      this.applyEncodedAwareness(payload as { data?: string });
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !this.destroyed) {
        void this.sendSyncStep1();
        this.scheduleSoloSyncFallback();
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
    if (!this.channel || this.destroyed) return;

    const payload = {
      type: "broadcast" as const,
      event,
      payload: { data: uint8ToBase64(bytes) },
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
    if (origin === this.origin || this.destroyed) return;
    void this.send(EVENT_UPDATE, update);
  };

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
    const changed = added.concat(updated, removed);
    if (changed.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, changed);
    void this.send(EVENT_AWARENESS, update);
  };

  private applyEncodedMessage(payload: { data?: string }) {
    if (!payload?.data || this.destroyed) return;
    const decoder = decoding.createDecoder(base64ToUint8(payload.data));
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

  private applyEncodedUpdate(payload: { data?: string }) {
    if (!payload?.data || this.destroyed) return;
    this.markPeerDataReceived();
    Y.applyUpdate(this.doc, base64ToUint8(payload.data), this.origin);
    this.setSynced(true);
  }

  private applyEncodedAwareness(payload: { data?: string }) {
    if (!payload?.data || this.destroyed) return;
    applyAwarenessUpdate(
      this.awareness,
      base64ToUint8(payload.data),
      this.origin,
    );
  }
}
