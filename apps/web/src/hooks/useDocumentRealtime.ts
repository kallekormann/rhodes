"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  activityActionLabel,
  formatActivityDetail,
  type EnrichedActivityRecord,
} from "@/lib/documents/activity-display";
import type { DocumentActivityEventType } from "@/lib/documents/activity";
import type { DocumentRecord } from "@/hooks/useDocument";

type RemoteDocumentUpdate = {
  updated_at: string;
};

export type DocumentRemoteConflict = {
  updatedAt: string;
  actorId: string | null;
  actorLabel: string;
  actionLabel: string;
  detail: string | null;
};

export type DocumentAwayNotice = DocumentRemoteConflict;

type UseDocumentRealtimeOptions = {
  documentId: string | null;
  currentUserId: string;
  enabled?: boolean;
  isDirty: boolean;
  onRemoteUpdate: (record: DocumentRecord) => void | Promise<void>;
};

const FALLBACK_POLL_MS = 2_000;
const OWN_SAVE_GRACE_MS = 3_000;

function mapActivityEntry(entry: EnrichedActivityRecord): DocumentRemoteConflict {
  const payload =
    entry.payload && typeof entry.payload === "object"
      ? (entry.payload as Record<string, unknown>)
      : {};

  return {
    updatedAt: entry.created_at,
    actorId: entry.actor_id,
    actorLabel: entry.actor_display_name?.trim() || "Someone",
    actionLabel: activityActionLabel(entry.event_type as DocumentActivityEventType),
    detail:
      formatActivityDetail(entry.event_type as DocumentActivityEventType, payload) ??
      entry.summary,
  };
}

export function useDocumentRealtime({
  documentId,
  currentUserId,
  enabled = true,
  isDirty,
  onRemoteUpdate,
}: UseDocumentRealtimeOptions) {
  const [live, setLive] = useState(false);
  const [conflict, setConflict] = useState<DocumentRemoteConflict | null>(null);
  const lastAppliedUpdatedAtRef = useRef<string | null>(null);
  const ownSaveGraceUntilRef = useRef(0);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  onRemoteUpdateRef.current = onRemoteUpdate;

  const fetchLatest = useCallback(async (): Promise<DocumentRecord | null> => {
    if (!documentId) return null;

    const response = await fetch(`/app/api/documents/${documentId}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    return (data.document as DocumentRecord) ?? null;
  }, [documentId]);

  const fetchLatestOtherActivity =
    useCallback(async (): Promise<DocumentRemoteConflict | null> => {
      if (!documentId) return null;

      const response = await fetch(`/app/api/documents/${documentId}/activity?limit=5`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return null;

      const entry = (data.activity as EnrichedActivityRecord[] | undefined)?.find(
        (row) => row.actor_id && row.actor_id !== currentUserId,
      );
      if (!entry) return null;
      return mapActivityEntry(entry);
    }, [currentUserId, documentId]);

  const applyRemote = useCallback(
    async (remoteUpdatedAt: string) => {
      if (Date.now() < ownSaveGraceUntilRef.current) {
        lastAppliedUpdatedAtRef.current = remoteUpdatedAt;
        return;
      }

      const latest = await fetchLatest();
      if (!latest) return;

      const notice = await fetchLatestOtherActivity();

      if (isDirty) {
        if (notice) {
          setConflict(notice);
        } else {
          setConflict({
            updatedAt: remoteUpdatedAt,
            actorId: null,
            actorLabel: "Someone",
            actionLabel: "edited the document",
            detail: null,
          });
        }
        return;
      }

      await onRemoteUpdateRef.current(latest);
      lastAppliedUpdatedAtRef.current = latest.updated_at;
      setConflict(null);
    },
    [fetchLatest, fetchLatestOtherActivity, isDirty],
  );

  const dismissConflict = useCallback(() => {
    setConflict(null);
  }, []);

  const reloadRemote = useCallback(async () => {
    const latest = await fetchLatest();
    if (!latest) return null;
    await onRemoteUpdateRef.current(latest);
    lastAppliedUpdatedAtRef.current = latest.updated_at;
    setConflict(null);
    return latest;
  }, [fetchLatest]);

  const markSynced = useCallback((updatedAt: string) => {
    lastAppliedUpdatedAtRef.current = updatedAt;
    ownSaveGraceUntilRef.current = Date.now() + OWN_SAVE_GRACE_MS;
    setConflict(null);
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
      )
      .subscribe((status) => {
        if (!cancelled) {
          setLive(status === "SUBSCRIBED");
        }
      });

    const poll = setInterval(() => {
      void (async () => {
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
    conflict,
    dismissConflict,
    reloadRemote,
    markSynced,
    setBaselineUpdatedAt: (updatedAt: string) => {
      lastAppliedUpdatedAtRef.current = updatedAt;
    },
  };
}

export function useDocumentAwayNotice(
  documentId: string | null,
  documentUpdatedAt: string | null,
  currentUserId: string,
) {
  const [awayNotice, setAwayNotice] = useState<DocumentAwayNotice | null>(null);
  const checkedDocRef = useRef<string | null>(null);

  useEffect(() => {
    if (!documentId || !documentUpdatedAt || !currentUserId) {
      setAwayNotice(null);
      return;
    }

    if (checkedDocRef.current === documentId) return;
    checkedDocRef.current = documentId;

    const storageKey = `rhodes:doc-seen:${documentId}`;
    const previousSeen = sessionStorage.getItem(storageKey);
    sessionStorage.setItem(storageKey, documentUpdatedAt);

    if (!previousSeen || previousSeen === documentUpdatedAt) {
      setAwayNotice(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const response = await fetch(`/app/api/documents/${documentId}/activity?limit=10`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || cancelled) return;

      const entries = (data.activity as EnrichedActivityRecord[]) ?? [];
      const previousSeenTime = new Date(previousSeen).getTime();
      const relevant = entries.find(
        (entry) =>
          entry.actor_id &&
          entry.actor_id !== currentUserId &&
          new Date(entry.created_at).getTime() > previousSeenTime,
      );

      if (!cancelled && relevant) {
        setAwayNotice(mapActivityEntry(relevant));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, documentId, documentUpdatedAt]);

  return {
    awayNotice,
    dismissAwayNotice: () => setAwayNotice(null),
  };
}
