"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceMember, WorkspacePendingInvite } from "@/lib/workspaces/members";
import { createTimedCache, isCacheFresh } from "@/lib/cache/swr-cache";

type MembersPayload = {
  members: WorkspaceMember[];
  pendingInvites: WorkspacePendingInvite[];
};

const membersCache = createTimedCache<MembersPayload>();

async function fetchMembers(workspaceId: string): Promise<MembersPayload> {
  const response = await fetch(`/app/api/workspaces/${workspaceId}/members`);
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    members?: WorkspaceMember[];
    pending_invites?: WorkspacePendingInvite[];
  };

  if (!response.ok) {
    throw new Error(body.error ?? "Failed to load members");
  }

  return {
    members: body.members ?? [],
    pendingInvites: body.pending_invites ?? [],
  };
}

function writeMembersCache(workspaceId: string, payload: MembersPayload) {
  membersCache.set(workspaceId, payload);
}

export function useWorkspaceMembers(workspaceId: string | null) {
  const cached = workspaceId ? membersCache.get(workspaceId) : undefined;
  const [members, setMembers] = useState<WorkspaceMember[]>(
    () => cached?.value.members ?? [],
  );
  const [pendingInvites, setPendingInvites] = useState<WorkspacePendingInvite[]>(
    () => cached?.value.pendingInvites ?? [],
  );
  const [loading, setLoading] = useState(() => Boolean(workspaceId) && !cached);
  const [error, setError] = useState<string | null>(null);

  const syncLocal = useCallback(
    (payload: MembersPayload) => {
      setMembers(payload.members);
      setPendingInvites(payload.pendingInvites);
      if (workspaceId) writeMembersCache(workspaceId, payload);
    },
    [workspaceId],
  );

  const addPendingInvite = useCallback(
    (invite: WorkspacePendingInvite) => {
      setPendingInvites((prev) => {
        if (prev.some((row) => row.id === invite.id || row.email === invite.email)) {
          return prev;
        }
        const next = [invite, ...prev];
        if (workspaceId) {
          writeMembersCache(workspaceId, { members, pendingInvites: next });
        }
        return next;
      });
    },
    [members, workspaceId],
  );

  const removeMemberLocal = useCallback(
    (userId: string) => {
      setMembers((prev) => {
        const next = prev.filter((member) => member.user_id !== userId);
        if (workspaceId) {
          writeMembersCache(workspaceId, { members: next, pendingInvites });
        }
        return next;
      });
    },
    [pendingInvites, workspaceId],
  );

  const removePendingInviteLocal = useCallback(
    (inviteId: string) => {
      setPendingInvites((prev) => {
        const next = prev.filter((invite) => invite.id !== inviteId);
        if (workspaceId) {
          writeMembersCache(workspaceId, { members, pendingInvites: next });
        }
        return next;
      });
    },
    [members, workspaceId],
  );

  const updateMemberRoleLocal = useCallback(
    (userId: string, role: WorkspaceMember["role"]) => {
      setMembers((prev) => {
        const next = prev.map((member) =>
          member.user_id === userId ? { ...member, role } : member,
        );
        if (workspaceId) {
          writeMembersCache(workspaceId, { members: next, pendingInvites });
        }
        return next;
      });
    },
    [pendingInvites, workspaceId],
  );

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      if (!workspaceId) {
        setMembers([]);
        setPendingInvites([]);
        setLoading(false);
        setError(null);
        return;
      }

      const hit = membersCache.get(workspaceId);
      if (hit && !options?.force && isCacheFresh(hit.fetchedAt)) {
        setMembers(hit.value.members);
        setPendingInvites(hit.value.pendingInvites);
        setLoading(false);
        setError(null);
        return;
      }

      if (!hit) setLoading(true);
      setError(null);

      try {
        const { value } = await membersCache.getOrFetch(
          workspaceId,
          () => fetchMembers(workspaceId),
          { force: options?.force },
        );
        setMembers(value.members);
        setPendingInvites(value.pendingInvites);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load members";
        setError(message);
        if (!hit) {
          setMembers([]);
          setPendingInvites([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    members,
    pendingInvites,
    loading,
    error,
    refresh: () => refresh({ force: true }),
    addPendingInvite,
    removeMemberLocal,
    removePendingInviteLocal,
    updateMemberRoleLocal,
    syncLocal,
  };
}
