import type { SharePermission } from "@/lib/documents/share-schemas";

export type IncomingShareAccess = {
  permission: SharePermission;
  offline_editing_allowed: boolean;
};

/** Whether the current user may cache/edit this document offline. */
export function canUserOfflineEditDocument(params: {
  userId: string;
  createdBy: string | null | undefined;
  incomingShare?: IncomingShareAccess | null;
}): boolean {
  if (params.createdBy === params.userId) return true;
  const share = params.incomingShare;
  if (!share) return false;
  return share.permission === "edit" && share.offline_editing_allowed;
}
