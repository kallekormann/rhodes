"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RemoteEditorPresence = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  editing: boolean;
  blockId: string | null;
  lastSeen: number;
};

type PresencePayload = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  editing: boolean;
  block_id: string | null;
  last_seen: number;
};

const STALE_MS = 4_000;

type UseDocumentPresenceOptions = {
  documentId: string | null;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isTyping: boolean;
  activeBlockId: string | null;
  enabled?: boolean;
};

export function useDocumentPresence({
  documentId,
  userId,
  displayName,
  avatarUrl,
  isTyping,
  activeBlockId,
  enabled = true,
}: UseDocumentPresenceOptions) {
  const [remoteEditors, setRemoteEditors] = useState<RemoteEditorPresence[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(
    null,
  );

  const activeRemoteEditor = useMemo(() => {
    const now = Date.now();
    return (
      remoteEditors.find(
        (editor) => editor.editing && now - editor.lastSeen < STALE_MS,
      ) ?? null
    );
  }, [remoteEditors]);

  const lockedBlockId = activeRemoteEditor?.blockId ?? null;
  const lockedByName = activeRemoteEditor?.displayName ?? null;

  useEffect(() => {
    if (!documentId || !enabled || !userId) {
      setRemoteEditors([]);
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(`presence:document:${documentId}`, {
      config: { presence: { key: userId } },
    });

    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState<PresencePayload>();
      const editors: RemoteEditorPresence[] = [];

      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (!entry || entry.user_id === userId) continue;
          editors.push({
            userId: entry.user_id,
            displayName: entry.display_name || "Someone",
            avatarUrl: entry.avatar_url ?? null,
            editing: Boolean(entry.editing),
            blockId: entry.block_id ?? null,
            lastSeen: entry.last_seen ?? Date.now(),
          });
        }
      }

      setRemoteEditors(editors);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({
          user_id: userId,
          display_name: displayName,
          avatar_url: avatarUrl,
          editing: isTyping,
          block_id: isTyping ? activeBlockId : null,
          last_seen: Date.now(),
        });
      });

    const heartbeat = window.setInterval(() => {
      void channel.track({
        user_id: userId,
        display_name: displayName,
        avatar_url: avatarUrl,
        editing: isTyping,
        block_id: isTyping ? activeBlockId : null,
        last_seen: Date.now(),
      });
    }, 1_000);

    return () => {
      window.clearInterval(heartbeat);
      channelRef.current = null;
      void supabase.removeChannel(channel);
      setRemoteEditors([]);
    };
  }, [activeBlockId, avatarUrl, displayName, documentId, enabled, userId]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !documentId || !enabled) return;

    void channel.track({
      user_id: userId,
      display_name: displayName,
      avatar_url: avatarUrl,
      editing: isTyping,
      block_id: isTyping ? activeBlockId : null,
      last_seen: Date.now(),
    });
  }, [activeBlockId, avatarUrl, displayName, documentId, enabled, isTyping, userId]);

  return {
    activeRemoteEditor,
    remoteEditors,
    lockedBlockId,
    lockedByName,
    isBlockedByRemoteEditor: Boolean(lockedBlockId),
  };
}
