"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnrichedActivityRecord } from "@/lib/documents/activity-display";
import type { DocumentRecord } from "@/hooks/useDocument";
import {
  mapActivityToRemoteNotice,
  pickLatestOtherActivitySince,
  type DocumentRemoteNotice,
} from "@/lib/documents/remote-document-notice";
import { ensureRealtimeAuth } from "@/lib/supabase/ensure-realtime-auth";

type RemoteDocumentUpdate = {
  updated_at: string;
};

export type DocumentAwayNotice = DocumentRemoteNotice;

type UseDocumentRealtimeOptions = {
  documentId: string | null;
  enabled?: boolean;
  /** Skip applying a remote update while the user is actively typing/dirty. */
  isDirty: boolean;
  onRemoteUpdate: (record: DocumentRecord) => void | Promise<void>;
};

/** Fallback when Realtime is down; keep high to avoid GET spam while editing. */
const FALLBACK_POLL_MS = 15_000;

async function fetchDocumentActivity(
  documentId: string,
): Promise<EnrichedActivityRecord[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return [];
  try {
    const response = await fetch(
      `/app/api/documents/${documentId}/activity?limit=20`,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return [];
    return (data.activity as EnrichedActivityRecord[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Notifies the editor session of title/metadata/comment changes made by
 * other collaborators. The document body is owned by Yjs (see
 * useYjsCollaboration) and is never applied from here.
 */
export function useDocumentRealtime({
  documentId,
  enabled = true,
  isDirty,
  onRemoteUpdate,
}: UseDocumentRealtimeOptions) {
  const [live, setLive] = useState(false);
  const lastAppliedUpdatedAtRef = useRef<string | null>(null);
  const isDirtyRef = useRef(isDirty);
  const liveRef = useRef(live);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  isDirtyRef.current = isDirty;
  liveRef.current = live;
  onRemoteUpdateRef.current = onRemoteUpdate;

  const fetchLatest = useCallback(async (): Promise<DocumentRecord | null> => {
    if (!documentId) return null;
    if (typeof navigator !== "undefined" && !navigator.onLine) return null;

    try {
      const response = await fetch(`/app/api/documents/${documentId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return null;
      return (data.document as DocumentRecord) ?? null;
    } catch {
      // Offline / network blip — never throw into React.
      return null;
    }
  }, [documentId]);

  const applyRemote = useCallback(
    async (remoteUpdatedAt: string) => {
      if (remoteUpdatedAt === lastAppliedUpdatedAtRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      // Soft-defer while actively dirty — title/metadata rarely change from
      // peers mid-keystroke, and the next poll/realtime tick will catch up.
      if (isDirtyRef.current) return;

      const latest = await fetchLatest();
      if (!latest) return;

      await onRemoteUpdateRef.current(latest);
      lastAppliedUpdatedAtRef.current = latest.updated_at;
    },
    [fetchLatest],
  );

  const reloadRemote = useCallback(async () => {
    const latest = await fetchLatest();
    if (!latest) return null;
    await onRemoteUpdateRef.current(latest);
    lastAppliedUpdatedAtRef.current = latest.updated_at;
    return latest;
  }, [fetchLatest]);

  const markSynced = useCallback((updatedAt: string) => {
    lastAppliedUpdatedAtRef.current = updatedAt;
  }, []);

  useEffect(() => {
    if (!documentId || !enabled) {
      setLive(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const channel = supabase
      .channel(`document:${documentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "documents",
          filter: `id=eq.${documentId}`,
        },
        (payload) => {
          const row = payload.new as RemoteDocumentUpdate;
          const remoteUpdatedAt =
            typeof row.updated_at === "string" ? row.updated_at : null;
          if (!remoteUpdatedAt) return;
          if (remoteUpdatedAt === lastAppliedUpdatedAtRef.current) return;

          void applyRemote(remoteUpdatedAt);
        },
      );

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (cancelled) return;

      channel.subscribe((status) => {
        if (!cancelled) {
          setLive(status === "SUBSCRIBED");
        }
      });
    })();

    // Prefer Realtime; only poll as a safety net (and skip while subscribed + clean).
    const poll = setInterval(() => {
      void (async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        if (liveRef.current && !isDirtyRef.current) return;

        const latest = await fetchLatest();
        if (!latest) return;
        if (latest.updated_at === lastAppliedUpdatedAtRef.current) return;

        await applyRemote(latest.updated_at);
      })();
    }, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
      setLive(false);
    };
  }, [applyRemote, documentId, enabled, fetchLatest]);

  return {
    live,
    reloadRemote,
    markSynced,
    setBaselineUpdatedAt: (updatedAt: string) => {
      lastAppliedUpdatedAtRef.current = updatedAt;
    },
  };
}

export function useDocumentAwayNotice(
  documentId: string | null,
  currentUserId: string,
) {
  const [awayNotice, setAwayNotice] = useState<DocumentAwayNotice | null>(null);
  const evaluatedForRef = useRef<string | null>(null);
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  useEffect(() => {
    evaluatedForRef.current = null;
    setAwayNotice(null);
  }, [documentId]);

  useEffect(() => {
    if (!documentId || !currentUserId) {
      return;
    }

    if (evaluatedForRef.current === documentId) {
      return;
    }
    evaluatedForRef.current = documentId;

    let cancelled = false;
    const storageKey = `rhodes:doc-seen:${documentId}`;

    void (async () => {
      const docResponse = await fetch(`/app/api/documents/${documentId}`);
      const docData = await docResponse.json().catch(() => ({}));
      if (!docResponse.ok || cancelled) return;

      const remote = docData.document as DocumentRecord | undefined;
      const updatedAt = remote?.updated_at;
      if (!updatedAt) return;

      try {
        const collabKey = `rhodes:collab-session:${documentId}`;
        if (sessionStorage.getItem(collabKey) === "1") {
          sessionStorage.setItem(`rhodes:doc-seen:${documentId}`, updatedAt);
          if (!cancelled) setAwayNotice(null);
          return;
        }
      } catch {
        /* private mode */
      }

      const previousSeen = sessionStorage.getItem(storageKey);
      sessionStorage.setItem(storageKey, updatedAt);

      if (!previousSeen || previousSeen === updatedAt) {
        if (!cancelled) setAwayNotice(null);
        return;
      }

      const entries = await fetchDocumentActivity(documentId);
      const entry = pickLatestOtherActivitySince(
        entries,
        previousSeen,
        currentUserIdRef.current,
      );

      if (!cancelled) {
        setAwayNotice(entry ? mapActivityToRemoteNotice(entry) : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, documentId]);

  return {
    awayNotice,
    dismissAwayNotice: () => setAwayNotice(null),
  };
}
