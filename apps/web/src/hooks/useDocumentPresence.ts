"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RemoteCollaboratorCursor } from "@/components/editor/extensions/remote-cursor-decorations";

export type RemoteEditorPresence = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  editing: boolean;
  blockId: string | null;
  blockIndex: number | null;
  selectionFrom: number | null;
  selectionTo: number | null;
  lastSeen: number;
};

type CursorBroadcastPayload = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  editing: boolean;
  block_id: string | null;
  block_index: number | null;
  selection_from: number | null;
  selection_to: number | null;
  last_seen: number;
};

const STALE_MS = 8_000;
const BROADCAST_EVENT = "cursor";
const CHANNEL_PREFIX = "document-collab";

export type CursorSelectionRef = MutableRefObject<{
  from: number;
  to: number;
} | null>;

type UseDocumentPresenceOptions = {
  documentId: string | null;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isTyping: boolean;
  activeBlockId: string | null;
  activeBlockIndex: number | null;
  selectionFrom: number | null;
  selectionTo: number | null;
  selectionRef?: CursorSelectionRef;
  enabled?: boolean;
};

function readPresenceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readLiveSelection(options: UseDocumentPresenceOptions): {
  from: number | null;
  to: number | null;
} {
  const live = options.selectionRef?.current;
  if (live && live.from >= 1) {
    return {
      from: live.from,
      to: live.to >= live.from ? live.to : live.from,
    };
  }

  if (options.selectionFrom != null && options.selectionFrom >= 1) {
    const from = options.selectionFrom;
    const to = options.selectionTo ?? from;
    return { from, to: to >= from ? to : from };
  }

  return { from: null, to: null };
}

function buildBroadcastPayload(options: UseDocumentPresenceOptions): CursorBroadcastPayload {
  const selection = readLiveSelection(options);

  return {
    user_id: options.userId,
    display_name: options.displayName || "A collaborator",
    avatar_url: options.avatarUrl,
    editing: options.isTyping,
    block_id: options.activeBlockId,
    block_index: options.activeBlockIndex,
    selection_from: selection.from,
    selection_to: selection.to,
    last_seen: Date.now(),
  };
}

function parseBroadcastPayload(
  raw: unknown,
  currentUserId: string,
): RemoteEditorPresence | null {
  if (!raw || typeof raw !== "object") return null;

  const payload = raw as CursorBroadcastPayload;
  const remoteUserId =
    typeof payload.user_id === "string" ? payload.user_id.trim() : "";
  if (!remoteUserId || remoteUserId === currentUserId) return null;

  return {
    userId: remoteUserId,
    displayName: payload.display_name?.trim() || "A collaborator",
    avatarUrl: payload.avatar_url ?? null,
    editing: Boolean(payload.editing),
    blockId: typeof payload.block_id === "string" ? payload.block_id : null,
    blockIndex: readPresenceNumber(payload.block_index),
    selectionFrom: readPresenceNumber(payload.selection_from),
    selectionTo: readPresenceNumber(payload.selection_to),
    lastSeen: Date.now(),
  };
}

function hasRenderableCursor(editor: RemoteEditorPresence): boolean {
  const hasSelection =
    editor.selectionFrom != null && editor.selectionFrom >= 1;
  return (
    hasSelection ||
    editor.blockIndex != null ||
    Boolean(editor.blockId)
  );
}

export function useDocumentPresence(options: UseDocumentPresenceOptions) {
  const { documentId, userId, enabled = true } = options;

  const [remoteEditors, setRemoteEditors] = useState<RemoteEditorPresence[]>([]);
  const [channelReady, setChannelReady] = useState(false);
  const peersRef = useRef<Map<string, RemoteEditorPresence>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(
    null,
  );
  const subscribedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const remoteCursors = useMemo((): RemoteCollaboratorCursor[] => {
    const now = Date.now();
    return remoteEditors
      .filter(
        (editor) => now - editor.lastSeen < STALE_MS && hasRenderableCursor(editor),
      )
      .map((editor) => ({
        userId: editor.userId,
        displayName: editor.displayName,
        avatarUrl: editor.avatarUrl,
        from: editor.selectionFrom ?? 0,
        to: editor.selectionTo ?? editor.selectionFrom ?? 0,
        blockId: editor.blockId,
        blockIndex: editor.blockIndex,
      }));
  }, [remoteEditors]);

  const activeRemoteEditor = useMemo(() => {
    const now = Date.now();
    return (
      remoteEditors.find((editor) => {
        if (now - editor.lastSeen >= STALE_MS) return false;
        return (
          (editor.selectionFrom != null && editor.selectionFrom >= 1) ||
          editor.blockIndex != null ||
          Boolean(editor.blockId)
        );
      }) ?? null
    );
  }, [remoteEditors]);

  const lockedBlockId = activeRemoteEditor?.blockId ?? null;
  const lockedBlockIndex = activeRemoteEditor?.blockIndex ?? null;
  const lockedSelectionFrom = activeRemoteEditor?.selectionFrom ?? null;
  const lockedByName = activeRemoteEditor?.displayName ?? null;

  const syncPeersState = () => {
    const now = Date.now();
    const next = [...peersRef.current.values()].filter(
      (editor) => now - editor.lastSeen < STALE_MS,
    );
    setRemoteEditors(next);
  };

  useEffect(() => {
    if (!documentId || !enabled || !userId) {
      peersRef.current.clear();
      subscribedRef.current = false;
      setChannelReady(false);
      setRemoteEditors([]);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    const channelName = `${CHANNEL_PREFIX}:${documentId}`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });
    channelRef.current = channel;

    const publishCursor = async () => {
      if (cancelled || !subscribedRef.current) return;
      if (!optionsRef.current.userId) return;

      try {
        await channel.send({
          type: "broadcast",
          event: BROADCAST_EVENT,
          payload: buildBroadcastPayload(optionsRef.current),
        });
      } catch {
        // Heartbeat retries after subscribe.
      }
    };

    const upsertPeer = (raw: unknown) => {
      const editor = parseBroadcastPayload(raw, userId);
      if (!editor) return;
      peersRef.current.set(editor.userId, editor);
      syncPeersState();
    };

    channel.on("broadcast", { event: BROADCAST_EVENT }, ({ payload }) => {
      upsertPeer(payload);
    });

    void (async () => {
      if (cancelled) return;

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          subscribedRef.current = true;
          setChannelReady(true);
          await publishCursor();
          return;
        }

        if (!cancelled) {
          subscribedRef.current = false;
          setChannelReady(false);
        }
      });
    })();

    const heartbeat = window.setInterval(() => {
      void publishCursor();
    }, 400);

    const prune = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [peerId, editor] of peersRef.current.entries()) {
        if (now - editor.lastSeen >= STALE_MS) {
          peersRef.current.delete(peerId);
          changed = true;
        }
      }
      if (changed) syncPeersState();
    }, 1_000);

    return () => {
      cancelled = true;
      subscribedRef.current = false;
      setChannelReady(false);
      window.clearInterval(heartbeat);
      window.clearInterval(prune);
      peersRef.current.clear();
      channelRef.current = null;
      void supabase.removeChannel(channel);
      setRemoteEditors([]);
    };
  }, [documentId, enabled, userId]);

  useEffect(() => {
    if (!channelReady) return;
    const channel = channelRef.current;
    if (!channel || !documentId || !enabled || !userId) return;

    void channel.send({
      type: "broadcast",
      event: BROADCAST_EVENT,
      payload: buildBroadcastPayload(optionsRef.current),
    }).catch(() => {
      // Heartbeat will retry.
    });
  }, [
    channelReady,
    options.activeBlockId,
    options.activeBlockIndex,
    options.avatarUrl,
    options.displayName,
    options.isTyping,
    options.selectionFrom,
    options.selectionTo,
    documentId,
    enabled,
    userId,
  ]);

  return {
    activeRemoteEditor,
    remoteEditors,
    remoteCursors,
    lockedBlockId,
    lockedBlockIndex,
    lockedSelectionFrom,
    lockedByName,
    isBlockedByRemoteEditor:
      lockedSelectionFrom != null ||
      lockedBlockIndex != null ||
      Boolean(lockedBlockId),
  };
}
