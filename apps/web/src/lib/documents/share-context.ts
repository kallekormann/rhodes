export type DocumentShareContext = {
  /** Document lives in the active scope */
  is_origin: boolean;
  /** Shared into the active scope from another scope */
  is_incoming: boolean;
  /** This scope's document has been shared outward */
  has_outgoing: boolean;
  /** People or scopes this document is shared with (origin scope view) */
  shared_with: string[];
  /** Display name of the person who shared this document (receiving scope view) */
  shared_by_user: string | null;
};

export type DocumentWithShareContext = {
  share_context?: DocumentShareContext | null;
};

export function shareContextLabel(
  context: DocumentShareContext | null | undefined,
): { short: string; detail: string } | null {
  if (!context) return null;

  if (context.is_incoming && context.shared_by_user) {
    return {
      short: "Shared by",
      detail: context.shared_by_user,
    };
  }

  if (context.is_origin && context.has_outgoing && context.shared_with.length > 0) {
    return {
      short: "Shared with",
      detail: context.shared_with.join(", "),
    };
  }

  return null;
}

export function emptyShareContext(): DocumentShareContext {
  return {
    is_origin: false,
    is_incoming: false,
    has_outgoing: false,
    shared_with: [],
    shared_by_user: null,
  };
}

type ShareGrantRecord = {
  grantee_type: "user" | "workspace";
  grantee_user_id: string | null;
  grantee_workspace_id: string | null;
};

export function isDocumentSharedWithScope(
  shares: ShareGrantRecord[],
  activeWorkspaceId: string,
  options?: {
    userId?: string | null;
    /** User-targeted shares are only visible in personal scopes */
    personalScope?: boolean;
  },
): boolean {
  return shares.some((share) => {
    if (
      share.grantee_type === "workspace" &&
      share.grantee_workspace_id === activeWorkspaceId
    ) {
      return true;
    }

    if (
      share.grantee_type === "user" &&
      options?.userId &&
      options.personalScope &&
      share.grantee_user_id === options.userId
    ) {
      return true;
    }

    return false;
  });
}

export async function documentAccessibleInActiveScope(
  documentId: string,
  documentWorkspaceId: string,
  activeWorkspaceId: string,
  options?: {
    userId?: string | null;
    personalScope?: boolean;
  },
): Promise<boolean> {
  if (documentWorkspaceId === activeWorkspaceId) return true;

  const response = await fetch(`/app/api/documents/${documentId}/shares`);
  const body = (await response.json().catch(() => ({}))) as {
    shares?: ShareGrantRecord[];
  };

  if (!response.ok) return false;

  return isDocumentSharedWithScope(body.shares ?? [], activeWorkspaceId, options);
}
