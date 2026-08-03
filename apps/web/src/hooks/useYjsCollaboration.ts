"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
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
import {
  persistLocalYjsState,
  RhodesYjsPersistence,
} from "@/lib/offline/yjs-rhodes-persistence";
import { ydocHasMeaningfulCollaborationBody } from "@/lib/collaboration/yjs-document";
import { seedYjsFromProjectionIfNeeded } from "@/lib/offline/seed-yjs-from-projection";
import { avatarHueForUser } from "@/lib/profile/avatar";
import { DocumentSessionPresence } from "@/lib/collaboration/document-session-presence";

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

const SERVER_YJS_FETCH_TIMEOUT_MS = 2_500;

async function fetchPersistedStateWithTimeout(
  documentId: string,
  timeoutMs = SERVER_YJS_FETCH_TIMEOUT_MS,
): Promise<PersistedYjsState> {
  return Promise.race([
    fetchPersistedState(documentId),
    new Promise<PersistedYjsState>((resolve) => {
      window.setTimeout(
        () => resolve({ state: null, seq: 0, updatedAt: null }),
        timeoutMs,
      );
    }),
  ]);
}

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
  userId?: string | null,
): Promise<boolean> {
  // Always mirror to rhodes-db so offline reopen works even if PUT /yjs fails.
  try {
    await persistLocalYjsState(documentId, state, userId);
  } catch (error) {
    console.error(`[yjs] local persist failed for ${documentId}:`, error);
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }
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
 * - The realtime broadcast provider connects only when another user has the
 *   document open (see DocumentSessionPresence).
 * - The merged CRDT state is durably persisted to Postgres (document_yjs_state).
 * - The body is seeded from Postgres JSON at most once ever per document —
 *   detected via a flag stored inside the Y.Doc itself, never re-applied after.
 */
export function useYjsCollaboration(params: {
  documentId: string | null;
  enabled: boolean;
  userId: string;
  displayName: string;
  /** Optional Postgres/React TipTap JSON used when IDB has no body yet. */
  getProjectionContent?: () => Record<string, unknown> | null | undefined;
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
  /** True when another user currently has this document open. */
  peersPresent: boolean;
  collaborationUser: CollaborationUser | null;
  /** True only when this Y.Doc has never been seeded (no local/server CRDT history). */
  needsInitialSeed: boolean;
  /** Immediately persist the current Y.Doc state to the server (e.g. after bootstrap seed). */
  flushPersist: () => void;
} {
  const {
    documentId,
    enabled,
    userId,
    displayName,
    getProjectionContent,
    onDisconnected,
  } = params;
  const getProjectionContentRef = useRef(getProjectionContent);
  getProjectionContentRef.current = getProjectionContent;
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<SupabaseYjsProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [synced, setSynced] = useState(false);
  const [catchupComplete, setCatchupComplete] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [needsInitialSeed, setNeedsInitialSeed] = useState(false);
  const [peersPresent, setPeersPresent] = useState(false);

  const onDisconnectedRef = useRef(onDisconnected);
  onDisconnectedRef.current = onDisconnected;
  const providerRef = useRef<SupabaseYjsProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const sessionPresenceRef = useRef<DocumentSessionPresence | null>(null);
  const forceAuthRef = useRef(false);

  useEffect(() => {
    const onOnline = () => {
      forceAuthRef.current = true;
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const collabEnabled = Boolean(documentId && enabled && userId);
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  useEffect(() => {
    if (!collabEnabled || !documentId) {
      providerRef.current?.destroy();
      providerRef.current = null;
      sessionPresenceRef.current?.stop();
      sessionPresenceRef.current = null;
      setProvider(null);
      setYdoc(null);
      setAwareness(null);
      setSynced(false);
      setCatchupComplete(false);
      setLocalReady(false);
      setNeedsInitialSeed(false);
      setPeersPresent(false);
      return;
    }

    let cancelled = false;
    const doc = new Y.Doc();
    docRef.current = doc;
    let idbPersistence: RhodesYjsPersistence | null = null;
    let serverPullTimer: number | null = null;
    let skipNextSyncedServerPull = false;

    const flushSoloServerState = () => {
      if (cancelled || providerRef.current || !docRef.current) return;
      void persistState(
        documentId,
        Y.encodeStateAsUpdate(docRef.current),
        userId,
      );
    };

    const destroyProvider = () => {
      const current = providerRef.current as
        | (SupabaseYjsProvider & {
            _unsub?: () => void;
            _unsubCatchup?: () => void;
            _unsubAwareness?: () => void;
          })
        | null;
      if (!current) return;

      const currentDoc = docRef.current;
      if (currentDoc) {
        void persistState(
          documentId,
          Y.encodeStateAsUpdate(currentDoc),
          userId,
        );
      }

      current._unsub?.();
      current._unsubCatchup?.();
      current._unsubAwareness?.();
      current.destroy();
      providerRef.current = null;

      if (serverPullTimer != null) {
        window.clearInterval(serverPullTimer);
        serverPullTimer = null;
      }

      setProvider(null);
      setAwareness(null);
      setSynced(false);
      setCatchupComplete(false);
    };

    const createProvider = async (attempt = 0): Promise<void> => {
      if (cancelled || providerRef.current) return;
      if (!sessionPresenceRef.current?.hasPeers) return;
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
      const server = await fetchPersistedStateWithTimeout(documentId);
      if (cancelled) return;
      if (server.state && server.state.length > 0) {
        const serverDoc = new Y.Doc();
        Y.applyUpdate(serverDoc, server.state);
        unsentBaselineVector = Y.encodeStateVector(serverDoc);
        Y.applyUpdate(doc, server.state);
        serverDoc.destroy();
        skipNextSyncedServerPull = true;
      }

      const nextProvider = new SupabaseYjsProvider({
        documentId,
        doc,
        supabase,
        reauth: async () => {
          await ensureRealtimeAuth(supabase, { force: true });
        },
        persist: async (state) => {
          await persistState(documentId, state, userId);
        },
        persistOnUnload: (state) => persistStateOnUnload(documentId, state),
        onDisconnected: () => {
          onDisconnectedRef.current?.();
        },
        unsentBaselineVector,
      });

      nextProvider.awareness.setLocalStateField("user", {
        id: userId,
        name: displayNameRef.current || "Collaborator",
        color: userColor(userId),
      });

      const unsub = nextProvider.onSynced((isSynced) => {
        if (!cancelled) setSynced(isSynced);
        if (!cancelled && isSynced) {
          void fetchPersistedState(documentId).then((server) => {
            if (cancelled || !server.state || server.state.length === 0) return;
            if (hasOfflineSessionMarker(documentId)) return;
            if (skipNextSyncedServerPull) {
              skipNextSyncedServerPull = false;
              return;
            }
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

      if (!sessionPresenceRef.current?.hasPeers) {
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
          name: displayNameRef.current || "Collaborator",
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

      idbPersistence = new RhodesYjsPersistence(documentId, doc, userId);

      await idbPersistence.whenSynced;
      if (cancelled) return;

      await clearStaleOfflineSnapshots(documentId);
      if (cancelled) return;

      // Solo: local IDB is enough on open — skip GET /yjs until a peer joins.
      if (!isOffline && !ydocHasMeaningfulCollaborationBody(doc)) {
        const server = await fetchPersistedStateWithTimeout(documentId);
        if (cancelled) return;
        if (server.state && server.state.length > 0) {
          applyServerState(doc, server.state);
        }
      }
      if (cancelled) return;

      await seedYjsFromProjectionIfNeeded(
        documentId,
        doc,
        getProjectionContentRef.current?.() ?? null,
      );
      if (cancelled) return;

      // Stale offline conflict snapshots must never rewind a fresh server load.
      if (!isOffline && ydocHasMeaningfulCollaborationBody(doc)) {
        await clearOfflineSnapshots(documentId);
      }

      // Empty paragraphs still count as fragment.length > 0 — only real text
      // means the CRDT already owns the body.
      const alreadySeeded = ydocHasMeaningfulCollaborationBody(doc);
      setNeedsInitialSeed(!alreadySeeded);
      setLocalReady(true);
      setYdoc(doc);

      const sessionPresence = new DocumentSessionPresence({
        documentId,
        userId,
        displayName: displayNameRef.current,
        onPeersPresentChange: (present) => {
          if (cancelled) return;
          setPeersPresent(present);
          if (present) {
            void createProvider();
            return;
          }
          destroyProvider();
        },
      });
      sessionPresenceRef.current = sessionPresence;
      void sessionPresence.start();
    })();

    const onOnlineRetry = () => {
      if (
        !providerRef.current &&
        sessionPresenceRef.current?.hasPeers &&
        typeof navigator !== "undefined" &&
        navigator.onLine
      ) {
        void createProvider();
      }
    };
    window.addEventListener("online", onOnlineRetry);
    window.addEventListener("pagehide", flushSoloServerState);
    const onVisibilityHidden = () => {
      if (window.document.visibilityState === "hidden") {
        flushSoloServerState();
      }
    };
    window.document.addEventListener("visibilitychange", onVisibilityHidden);

    const providerRetryTimer = window.setInterval(() => {
      if (cancelled || providerRef.current) return;
      if (!sessionPresenceRef.current?.hasPeers) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      void createProvider();
    }, PROVIDER_RETRY_BASE_MS * 2);

    return () => {
      cancelled = true;
      flushSoloServerState();
      if (serverPullTimer != null) {
        window.clearInterval(serverPullTimer);
        serverPullTimer = null;
      }
      window.clearInterval(providerRetryTimer);
      window.removeEventListener("online", onOnlineRetry);
      window.removeEventListener("pagehide", flushSoloServerState);
      window.document.removeEventListener("visibilitychange", onVisibilityHidden);
      sessionPresenceRef.current?.stop();
      sessionPresenceRef.current = null;
      destroyProvider();
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
      setPeersPresent(false);
    };
  }, [collabEnabled, documentId, userId]);

  useEffect(() => {
    sessionPresenceRef.current?.setDisplayName(displayName);
  }, [displayName]);

  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || !userId) return;
    provider.awareness.setLocalStateField("user", {
      id: userId,
      name: displayNameRef.current || "Collaborator",
      color: userColor(userId),
    });
    provider.nudgeLocalAwareness();
  }, [displayName, userId]);

  const collaborationUser = useMemo((): CollaborationUser | null => {
    if (!userId) return null;
    return {
      userId,
      name: displayName || "Collaborator",
      color: userColor(userId),
    };
  }, [displayName, userId]);

  const flushPersist = useMemo(() => {
    return (options?: { server?: boolean }) => {
      const doc = docRef.current;
      const currentProvider = providerRef.current;
      if (!doc || !documentId) return;
      if (currentProvider) {
        currentProvider.flushPersist();
        return;
      }
      void persistLocalYjsState(
        documentId,
        Y.encodeStateAsUpdate(doc),
        userId,
      ).catch((error) => {
        console.error(`[yjs] local flush failed for ${documentId}:`, error);
      });
      if (options?.server) {
        void persistState(documentId, Y.encodeStateAsUpdate(doc), userId);
      }
    };
  }, [documentId, userId]);

  return {
    ydoc,
    provider,
    awareness,
    synced,
    catchupComplete,
    docReady: localReady || synced,
    collabActive: collabEnabled && synced && ydoc != null && provider != null,
    peersPresent,
    collaborationUser,
    needsInitialSeed,
    flushPersist,
  };
}
