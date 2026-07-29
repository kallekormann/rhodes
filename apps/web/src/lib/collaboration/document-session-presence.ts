import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureRealtimeAuth } from "@/lib/supabase/ensure-realtime-auth";

const CHANNEL_PREFIX = "document-session";
const PRESENCE_EVENT = "presence";
const STALE_MS = 6_000;
const SESSION_HEARTBEAT_MS = 5_000;
/** Keep the Yjs provider warm briefly after the last peer leaves. */
const PEER_GRACE_MS = 8_000;

export type SessionPresencePayload = {
  user_id: string;
  display_name: string;
  last_seen: number;
};

export function parseSessionPresencePayload(
  raw: unknown,
  currentUserId: string,
): SessionPresencePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as SessionPresencePayload;
  const userId =
    typeof payload.user_id === "string" ? payload.user_id.trim() : "";
  if (!userId || userId === currentUserId) return null;
  const lastSeen =
    typeof payload.last_seen === "number" && Number.isFinite(payload.last_seen)
      ? payload.last_seen
      : Date.now();
  return {
    user_id: userId,
    display_name:
      typeof payload.display_name === "string" && payload.display_name.trim()
        ? payload.display_name.trim()
        : "Collaborator",
    last_seen: lastSeen,
  };
}

export function hasFreshRemotePeers(
  peers: Map<string, number>,
  now = Date.now(),
): boolean {
  for (const lastSeen of peers.values()) {
    if (now - lastSeen < STALE_MS) return true;
  }
  return false;
}

type DocumentSessionPresenceOptions = {
  documentId: string;
  userId: string;
  displayName: string;
  onPeersPresentChange: (peersPresent: boolean) => void;
  supabase?: SupabaseClient;
};

/**
 * Lightweight Realtime heartbeats to detect when another user has the same
 * document open. Used to gate the heavier Yjs broadcast provider.
 */
export class DocumentSessionPresence {
  private readonly documentId: string;
  private readonly userId: string;
  private displayName: string;
  private readonly onPeersPresentChange: (peersPresent: boolean) => void;
  private readonly supabase: SupabaseClient;
  private readonly peers = new Map<string, number>();
  private channel: ReturnType<SupabaseClient["channel"]> | null = null;
  private subscribed = false;
  private cancelled = false;
  private peersPresent = false;
  private heartbeatTimer: number | null = null;
  private pruneTimer: number | null = null;
  private graceTimer: number | null = null;

  constructor(options: DocumentSessionPresenceOptions) {
    this.documentId = options.documentId;
    this.userId = options.userId;
    this.displayName = options.displayName;
    this.onPeersPresentChange = options.onPeersPresentChange;
    this.supabase = options.supabase ?? createClient();
  }

  setDisplayName(displayName: string): void {
    this.displayName = displayName;
  }

  get hasPeers(): boolean {
    return this.peersPresent;
  }

  async start(): Promise<void> {
    this.cancelled = false;
    await ensureRealtimeAuth(this.supabase);
    if (this.cancelled) return;

    const channel = this.supabase.channel(
      `${CHANNEL_PREFIX}:${this.documentId}`,
      {
        config: {
          broadcast: { ack: false, self: false },
        },
      },
    );
    this.channel = channel;

    channel.on("broadcast", { event: PRESENCE_EVENT }, ({ payload }) => {
      const peer = parseSessionPresencePayload(payload, this.userId);
      if (!peer) return;
      this.peers.set(peer.user_id, peer.last_seen);
      this.recomputePeersPresent();
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && !this.cancelled) {
        this.subscribed = true;
        await this.publishHeartbeat();
        return;
      }
      if (!this.cancelled) {
        this.subscribed = false;
      }
    });

    this.heartbeatTimer = window.setInterval(() => {
      void this.publishHeartbeat();
    }, SESSION_HEARTBEAT_MS);

    this.pruneTimer = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [peerId, lastSeen] of this.peers.entries()) {
        if (now - lastSeen >= STALE_MS) {
          this.peers.delete(peerId);
          changed = true;
        }
      }
      if (changed) this.recomputePeersPresent();
    }, 1_000);
  }

  stop(): void {
    this.cancelled = true;
    this.subscribed = false;
    if (this.heartbeatTimer != null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pruneTimer != null) {
      window.clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    if (this.graceTimer != null) {
      window.clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
    this.peers.clear();
    const channel = this.channel;
    this.channel = null;
    if (channel) void this.supabase.removeChannel(channel);
    if (this.peersPresent) {
      this.peersPresent = false;
      this.onPeersPresentChange(false);
    }
  }

  private buildPayload(): SessionPresencePayload {
    return {
      user_id: this.userId,
      display_name: this.displayName || "Collaborator",
      last_seen: Date.now(),
    };
  }

  private async publishHeartbeat(): Promise<void> {
    if (this.cancelled || !this.subscribed || !this.channel) return;
    try {
      await this.channel.send({
        type: "broadcast",
        event: PRESENCE_EVENT,
        payload: this.buildPayload(),
      });
    } catch {
      /* next heartbeat retries */
    }
  }

  private recomputePeersPresent(): void {
    const fresh = hasFreshRemotePeers(this.peers);
    if (fresh) {
      if (this.graceTimer != null) {
        window.clearTimeout(this.graceTimer);
        this.graceTimer = null;
      }
      if (!this.peersPresent) {
        this.peersPresent = true;
        this.onPeersPresentChange(true);
      }
      return;
    }

    if (!this.peersPresent || this.graceTimer != null) return;

    this.graceTimer = window.setTimeout(() => {
      this.graceTimer = null;
      if (hasFreshRemotePeers(this.peers)) return;
      this.peersPresent = false;
      this.onPeersPresentChange(false);
    }, PEER_GRACE_MS);
  }
}
