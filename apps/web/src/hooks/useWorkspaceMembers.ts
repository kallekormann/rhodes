"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceMember, WorkspacePendingInvite } from "@/lib/workspaces/members";

export function useWorkspaceMembers(workspaceId: string | null) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspacePendingInvite[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);

  const addPendingInvite = useCallback((invite: WorkspacePendingInvite) => {
    setPendingInvites((prev) => {
      if (prev.some((row) => row.id === invite.id || row.email === invite.email)) {
        return prev;
      }
      return [invite, ...prev];
    });
  }, []);

  const removeMemberLocal = useCallback((userId: string) => {
    setMembers((prev) => prev.filter((member) => member.user_id !== userId));
  }, []);

  const removePendingInviteLocal = useCallback((inviteId: string) => {
    setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
  }, []);

  const updateMemberRoleLocal = useCallback((userId: string, role: WorkspaceMember["role"]) => {
    setMembers((prev) =>
      prev.map((member) =>
        member.user_id === userId ? { ...member, role } : member,
      ),
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setMembers([]);
      setPendingInvites([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/app/api/workspaces/${workspaceId}/members`);
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        members?: WorkspaceMember[];
        pending_invites?: WorkspacePendingInvite[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load members");
      }

      setMembers(body.members ?? []);
      setPendingInvites(body.pending_invites ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load members";
      setError(message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    members,
    pendingInvites,
    loading,
    error,
    refresh,
    addPendingInvite,
    removeMemberLocal,
    removePendingInviteLocal,
    updateMemberRoleLocal,
  };
}
