"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnrichedActivityRecord } from "@/lib/documents/activity-display";
import type { DocumentRecord } from "@/hooks/useDocument";
import {
  mapActivityToRemoteNotice,
  pickLatestOtherActivity,
  pickLatestOtherActivitySince,
  type DocumentRemoteNotice,
} from "@/lib/documents/remote-document-notice";
import { ensureRealtimeAuth } from "@/lib/supabase/ensure-realtime-auth";

type RemoteDocumentUpdate = {
  updated_at: string;
};

export type DocumentRemoteConflict = DocumentRemoteNotice;
export type DocumentAwayNotice = DocumentRemoteNotice;

type UseDocumentRealtimeOptions = {
  documentId: string | null;
  enabled?: boolean;
  isDirty: boolean;
  isTyping: boolean;
  currentUserId?: string;
  getLocalContentPlain?: () => string;
  onRemoteUpdate: (record: DocumentRecord) => void | Promise<void>;
};

const FALLBACK_POLL_MS = 1_000;

async function fetchDocumentActivity(
  documentId: string,
): Promise<EnrichedActivityRecord[]> {
  const response = await fetch(`/app/api/documents/${documentId}/activity?limit=20`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return [];
  return (data.activity as EnrichedActivityRecord[]) ?? [];
}

export function useDocumentRealtime({
  documentId,
  enabled = true,
  isDirty,
  isTyping,
  currentUserId,
  getLocalContentPlain,
  onRemoteUpdate,
}: UseDocumentRealtimeOptions) {
  const [live, setLive] = useState(false);
  const [remoteConflict, setRemoteConflict] = useState<DocumentRemoteConflict | null>(
    null,
  );
  const lastAppliedUpdatedAtRef = useRef<string | null>(null);
  const isDirtyRef = useRef(isDirty);
  const isTypingRef = useRef(isTyping);
  const currentUserIdRef = useRef(currentUserId);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  const getLocalContentPlainRef = useRef(getLocalContentPlain);
  isDirtyRef.current = isDirty;
  isTypingRef.current = isTyping;
  currentUserIdRef.current = currentUserId;
  onRemoteUpdateRef.current = onRemoteUpdate;
  getLocalContentPlainRef.current = getLocalContentPlain;

  const dismissConflict = useCallback(() => {
    setRemoteConflict(null);
  }, []);

  const buildConflictNotice = useCallback(
    async (updatedAt: string): Promise<DocumentRemoteConflict> => {
      if (!documentId) {
        return {
          updatedAt,
          actorId: null,
          actorLabel: "A collaborator",
          actionLabel: "edited the document",
          detail: null,
        };
      }

      const entries = await fetchDocumentActivity(documentId);
      const entry = pickLatestOtherActivity(
        entries,
        currentUserIdRef.current ?? "",
      );
      if (entry) {
        return mapActivityToRemoteNotice(entry);
      }

      return {
        updatedAt,
        actorId: null,
        actorLabel: "A collaborator",
        actionLabel: "edited the document",
        detail: null,
      };
    },
    [documentId],
  );

  const flagConflict = useCallback(
    async (updatedAt: string) => {
      const notice = await buildConflictNotice(updatedAt);
      setRemoteConflict(notice);
    },
    [buildConflictNotice],
  );

  const fetchLatest = useCallback(async (): Promise<DocumentRecord | null> => {
    if (!documentId) return null;

    const response = await fetch(`/app/api/documents/${documentId}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    return (data.document as DocumentRecord) ?? null;
  }, [documentId]);

  const applyRemote = useCallback(
    async (remoteUpdatedAt: string, force = false) => {
      if (!force && remoteUpdatedAt === lastAppliedUpdatedAtRef.current) {
        return;
      }

      if (!force && isDirtyRef.current) {
        if (isTypingRef.current) {
          return;
        }
        await flagConflict(remoteUpdatedAt);
        return;
      }

      const latest = await fetchLatest();
      if (!latest) return;

      await onRemoteUpdateRef.current(latest);
      lastAppliedUpdatedAtRef.current = latest.updated_at;
      setRemoteConflict(null);
    },
    [fetchLatest, flagConflict],
  );

  const reloadRemote = useCallback(async () => {
    const latest = await fetchLatest();
    if (!latest) return null;
    await onRemoteUpdateRef.current(latest);
    lastAppliedUpdatedAtRef.current = latest.updated_at;
    setRemoteConflict(null);
    return latest;
  }, [fetchLatest]);

  const keepLocal = useCallback(() => {
    if (remoteConflict?.updatedAt) {
      lastAppliedUpdatedAtRef.current = remoteConflict.updatedAt;
    }
    setRemoteConflict(null);
  }, [remoteConflict?.updatedAt]);

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

    const poll = setInterval(() => {
      void (async () => {
        const latest = await fetchLatest();
        if (!latest) return;

        const remotePlain = latest.content_plain?.trim() ?? "";
        const localPlain = getLocalContentPlainRef.current?.().trim() ?? "";
        const timestampMatches =
          latest.updated_at === lastAppliedUpdatedAtRef.current;
        const contentDrift =
          timestampMatches &&
          localPlain !== remotePlain &&
          !(isDirtyRef.current && isTypingRef.current);

        if (timestampMatches && !contentDrift) {
          return;
        }

        if (contentDrift && isDirtyRef.current) {
          await flagConflict(latest.updated_at);
          return;
        }

        await applyRemote(latest.updated_at, contentDrift);
      })();
    }, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
      setLive(false);
    };
  }, [applyRemote, documentId, enabled, fetchLatest, flagConflict]);

  return {
    live,
    remoteConflict,
    dismissConflict,
    reloadRemote,
    keepLocal,
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

      const updatedAt = (docData.document as DocumentRecord | undefined)?.updated_at;
      if (!updatedAt) return;

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
