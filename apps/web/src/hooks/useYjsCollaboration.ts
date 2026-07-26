"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { Awareness } from "y-protocols/awareness";
import { createClient } from "@/lib/supabase/client";
import { ensureRealtimeAuth } from "@/lib/supabase/ensure-realtime-auth";
import {
  SupabaseYjsProvider,
  base64ToUint8,
  uint8ToBase64,
} from "@/lib/collaboration/supabase-yjs-provider";
import {
  clearOfflineSnapshots,
  clearStaleOfflineSnapshots,
  hasOfflineSessionMarker,
} from "@/lib/offline/yjs-offline-snapshot";
import { clearYjsIndexedDbPersistence } from "@/lib/collaboration/yjs-idb";
import { ydocHasCollaborationBody } from "@/lib/collaboration/yjs-document";
import { avatarHueForUser } from "@/lib/profile/avatar";

export type CollaborationUser = {
  userId: string;
  name: string;
  color: string;
};

function userColor(userId: string): string {
  // TipTap CollaborationCursor rejects modern space-separated hsl() — use hex.
  const hue = avatarHueForUser(userId);
  const s = 0.62;
  const l = 0.46;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

type PersistedYjsState = {
  state: Uint8Array | null;
  seq: number;
  updatedAt: string | null;
};

async function fetchPersistedState(
  documentId: string,
): Promise<PersistedYjsState> {
  try {
    const response = await fetch(`/app/api/documents/${documentId}/yjs`);
    if (!response.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[yjs] GET /yjs failed for ${documentId}: ${response.status}`,
        );
      }
      return { state: null, seq: 0, updatedAt: null };
    }
    const data = await response.json().catch(() => ({}));
    if (typeof data?.state !== "string") {
      return { state: null, seq: 0, updatedAt: null };
    }
    return {
      state: base64ToUint8(data.state),
      seq: typeof data.seq === "number" ? data.seq : 0,
      updatedAt:
        typeof data.updated_at === "string" ? data.updated_at : null,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[yjs] GET /yjs error for ${documentId}:`, error);
    }
    return { state: null, seq: 0, updatedAt: null };
  }
}

async function persistState(
  documentId: string,
  state: Uint8Array,
): Promise<boolean> {
  try {
    const response = await fetch(`/app/api/documents/${documentId}/yjs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: uint8ToBase64(state) }),
    });
    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.warn(
        `[yjs] PUT /yjs failed for ${documentId}: ${response.status}`,
      );
    }
    return response.ok;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[yjs] PUT /yjs error for ${documentId}:`, error);
    }
    return false;
  }
}

function persistStateOnUnload(documentId: string, state: Uint8Array): void {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) return;
  const blob = new Blob(
    [JSON.stringify({ state: uint8ToBase64(state) })],
    { type: "application/json" },
  );
  navigator.sendBeacon(`/app/api/documents/${documentId}/yjs`, blob);
}

const PROVIDER_RETRY_ATTEMPTS = 3;
const PROVIDER_RETRY_BASE_MS = 2_000;
const SESSION_WAIT_ATTEMPTS = 20;
const SESSION_WAIT_MS = 250;
const SERVER_PULL_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAuthSession(
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  for (let attempt = 0; attempt < SESSION_WAIT_ATTEMPTS; attempt++) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) return true;
    await sleep(SESSION_WAIT_MS);
  }
  return false;
}

/** Shared key marking whether this Y.Doc has ever been seeded from Postgres JSON. */
const SEEDED_MAP_KEY = "rhodes";
const SEEDED_FLAG = "seeded";

function applyServerState(doc: Y.Doc, state: Uint8Array): void {
  if (state.length === 0) return;
  Y.applyUpdate(doc, state);
}

/**
 * Shared Y.Doc + Supabase Realtime provider for TipTap Collaboration.
 * The Y.Doc is the single source of truth for the document body:
 * - The doc + IndexedDB persistence stay mounted while offline, so offline
 *   edits go straight into the CRDT and merge automatically on reconnect —
 *   no separate offline-merge system needed.
 * - The realtime broadcast provider connects lazily once online.
 * - The merged CRDT state is durably persisted to Postgres (document_yjs_state).
 * - The body is seeded from Postgres JSON at most once ever per document —
 *   detected via a flag stored inside the Y.Doc itself, never re-applied after.
 */
export function useYjsCollaboration(params: {
  documentId: string | null;
  enabled: boolean;
  userId: string;
  displayName: string;
  onDisconnected?: () => void;
}): {
  ydoc: Y.Doc | null;
  provider: SupabaseYjsProvider | null;
  awareness: Awareness | null;
  /** True once peers have actually synced over the realtime channel. */
  synced: boolean;
  /** True once offline catch-up has merged peer edits (not just solo-sync fallback). */
  catchupComplete: boolean;
  /** True once the Y.Doc is usable for editing (local/offline included). */
  docReady: boolean;
  collabActive: boolean;
  collaborationUser: CollaborationUser | null;
  /** True only when this Y.Doc has never been seeded (no local/server CRDT history). */
  needsInitialSeed: boolean;
  /** Immediately persist the current Y.Doc state to the server (e.g. after bootstrap seed). */
  flushPersist: () => void;
} {
  const { documentId, enabled, userId, displayName, onDisconnected } = params;
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<SupabaseYjsProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [synced, setSynced] = useState(false);
  const [catchupComplete, setCatchupComplete] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [needsInitialSeed, setNeedsInitialSeed] = useState(false);

  const onDisconnectedRef = useRef(onDisconnected);
  onDisconnectedRef.current = onDisconnected;
  const providerRef = useRef<SupabaseYjsProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const forceAuthRef = useRef(false);

  useEffect(() => {
    const onOnline = () => {
      forceAuthRef.current = true;
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const collabEnabled = Boolean(documentId && enabled && userId);

  useEffect(() => {
    if (!collabEnabled || !documentId) {
      providerRef.current?.destroy();
      providerRef.current = null;
      setProvider(null);
      setYdoc(null);
      setAwareness(null);
      setSynced(false);
      setCatchupComplete(false);
      setLocalReady(false);
      setNeedsInitialSeed(false);
      return;
    }

    let cancelled = false;
    const doc = new Y.Doc();
    docRef.current = doc;
    let idbPersistence: IndexeddbPersistence | null = null;
    let serverPullTimer: number | null = null;

    const createProvider = async (attempt = 0): Promise<void> => {
      if (cancelled || providerRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const supabase = createClient();
      const forceAuth = forceAuthRef.current;
      forceAuthRef.current = false;

      const hasSession = await waitForAuthSession(supabase);
      if (cancelled) return;
      if (!hasSession) {
        if (attempt < PROVIDER_RETRY_ATTEMPTS - 1) {
          await sleep(PROVIDER_RETRY_BASE_MS * (attempt + 1));
          return createProvider(attempt + 1);
        }
        if (process.env.NODE_ENV !== "production") {
          console.warn("[yjs] Realtime provider skipped — no auth session");
        }
        return;
      }

      try {
        await ensureRealtimeAuth(supabase, { force: forceAuth });
      } catch {
        if (!cancelled && attempt < PROVIDER_RETRY_ATTEMPTS - 1) {
          await sleep(PROVIDER_RETRY_BASE_MS * (attempt + 1));
          return createProvider(attempt + 1);
        }
        return;
      }
      if (cancelled) return;

      // Merge latest server state so reconnecting after offline has a correct
      // broadcast baseline (local-only ops = diff vs server, not vs current doc).
      let unsentBaselineVector: Uint8Array | null = null;
      const server = await fetchPersistedState(documentId);
      if (cancelled) return;
      if (server.state && server.state.length > 0) {
        const serverDoc = new Y.Doc();
        Y.applyUpdate(serverDoc, server.state);
        unsentBaselineVector = Y.encodeStateVector(serverDoc);
        Y.applyUpdate(doc, server.state);
        serverDoc.destroy();
      }

      const nextProvider = new SupabaseYjsProvider({
        documentId,
        doc,
        supabase,
        reauth: async () => {
          await ensureRealtimeAuth(supabase, { force: true });
        },
        persist: async (state) => {
          await persistState(documentId, state);
        },
        persistOnUnload: (state) => persistStateOnUnload(documentId, state),
        onDisconnected: () => {
          onDisconnectedRef.current?.();
        },
        unsentBaselineVector,
      });

      nextProvider.awareness.setLocalStateField("user", {
        id: userId,
        name: displayName || "Collaborator",
        color: userColor(userId),
      });

      const unsub = nextProvider.onSynced((isSynced) => {
        if (!cancelled) setSynced(isSynced);
        if (!cancelled && isSynced) {
          void fetchPersistedState(documentId).then((server) => {
            if (cancelled || !server.state || server.state.length === 0) return;
            if (hasOfflineSessionMarker(documentId)) return;
            applyServerState(doc, server.state);
          });
        }
      });
      const unsubCatchup = nextProvider.onCatchupComplete((ready) => {
        if (!cancelled) setCatchupComplete(ready);
      });

      if (cancelled) {
        unsub();
        unsubCatchup();
        (
          nextProvider as SupabaseYjsProvider & { _unsubAwareness?: () => void }
        )._unsubAwareness?.();
        nextProvider.destroy();
        return;
      }

      providerRef.current = nextProvider;
      setProvider(nextProvider);
      setAwareness(nextProvider.awareness);
      (nextProvider as SupabaseYjsProvider & { _unsub?: () => void })._unsub =
        unsub;
      (
        nextProvider as SupabaseYjsProvider & { _unsubCatchup?: () => void }
      )._unsubCatchup = unsubCatchup;

      const refreshAwareness = () => {
        nextProvider.awareness.setLocalStateField("user", {
          id: userId,
          name: displayName || "Collaborator",
          color: userColor(userId),
        });
        nextProvider.nudgeLocalAwareness();
      };
      refreshAwareness();
      const unsubAwareness = nextProvider.onSynced((isSynced) => {
        if (isSynced) refreshAwareness();
      });
      (
        nextProvider as SupabaseYjsProvider & { _unsubAwareness?: () => void }
      )._unsubAwareness = unsubAwareness;

      if (serverPullTimer == null) {
        serverPullTimer = window.setInterval(() => {
          if (cancelled || !providerRef.current?.isSynced) return;
          if (hasOfflineSessionMarker(documentId)) return;
          void fetchPersistedState(documentId).then((server) => {
            if (cancelled || !server.state || server.state.length === 0) return;
            applyServerState(doc, server.state);
          });
        }, SERVER_PULL_MS);
      }
    };

    void (async () => {
      const isOffline =
        typeof navigator !== "undefined" && !navigator.onLine;

      let serverState: Uint8Array | null = null;
      if (!isOffline) {
        const server = await fetchPersistedState(documentId);
        if (cancelled) return;
        // Online reload: Postgres wins over stale y-indexeddb.
        await clearYjsIndexedDbPersistence(documentId);
        if (server.state && server.state.length > 0) {
          serverState = server.state;
          applyServerState(doc, serverState);
        }
      }

      idbPersistence = new IndexeddbPersistence(documentId, doc);
      await idbPersistence.whenSynced;
      if (cancelled) return;

      await clearStaleOfflineSnapshots(documentId);
      if (cancelled) return;

      if (serverState) {
        applyServerState(doc, serverState);
      } else if (!isOffline) {
        const server = await fetchPersistedState(documentId);
        if (cancelled) return;
        if (server.state && server.state.length > 0) {
          applyServerState(doc, server.state);
        }
      }
      if (cancelled) return;

      // Stale offline conflict snapshots must never rewind a fresh server load.
      if (!isOffline && ydocHasCollaborationBody(doc)) {
        await clearOfflineSnapshots(documentId);
      }

      const alreadySeeded =
        doc.getMap(SEEDED_MAP_KEY).get(SEEDED_FLAG) === true ||
        ydocHasCollaborationBody(doc);
      setNeedsInitialSeed(!alreadySeeded);
      setLocalReady(true);
      setYdoc(doc);

      if (isOffline) {
        await createProvider();
        return;
      }

      await createProvider();
      if (cancelled) return;
    })();

    const onOnlineRetry = () => {
      if (!providerRef.current) {
        void createProvider();
      }
    };
    window.addEventListener("online", onOnlineRetry);

    // Retry provider creation while online if the first attempt failed.
    const providerRetryTimer = window.setInterval(() => {
      if (cancelled || providerRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      void createProvider();
    }, PROVIDER_RETRY_BASE_MS * 2);

    return () => {
      cancelled = true;
      if (serverPullTimer != null) {
        window.clearInterval(serverPullTimer);
        serverPullTimer = null;
      }
      window.clearInterval(providerRetryTimer);
      window.removeEventListener("online", onOnlineRetry);
      const current = providerRef.current as
        | (SupabaseYjsProvider & { _unsub?: () => void; _unsubCatchup?: () => void })
        | null;
      current?._unsub?.();
      current?._unsubCatchup?.();
      (
        current as SupabaseYjsProvider & { _unsubAwareness?: () => void }
      )?._unsubAwareness?.();
      current?.destroy();
      providerRef.current = null;
      idbPersistence?.destroy();
      doc.destroy();
      docRef.current = null;
      setProvider(null);
      setYdoc(null);
      setAwareness(null);
      setSynced(false);
      setCatchupComplete(false);
      setLocalReady(false);
      setNeedsInitialSeed(false);
    };
  }, [collabEnabled, documentId, displayName, userId]);

  const collaborationUser = useMemo((): CollaborationUser | null => {
    if (!userId) return null;
    return {
      userId,
      name: displayName || "Collaborator",
      color: userColor(userId),
    };
  }, [displayName, userId]);

  const flushPersist = useMemo(() => {
    return () => {
      const doc = docRef.current;
      const currentProvider = providerRef.current;
      if (!doc || !documentId) return;
      if (currentProvider) {
        currentProvider.flushPersist();
        return;
      }
      void persistState(documentId, Y.encodeStateAsUpdate(doc));
    };
  }, [documentId]);

  return {
    ydoc,
    provider,
    awareness,
    synced,
    catchupComplete,
    docReady: localReady || synced,
    collabActive: collabEnabled && synced && ydoc != null && provider != null,
    collaborationUser,
    needsInitialSeed,
    flushPersist,
  };
}
