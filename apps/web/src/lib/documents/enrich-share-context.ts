import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyShareContext,
  type DocumentShareContext,
} from "@/lib/documents/share-context";

type DocumentRow = {
  id: string;
  workspace_id: string;
};

type ShareRow = {
  document_id: string;
  grantee_type: string;
  grantee_workspace_id: string | null;
  label: string;
};

type IncomingShareRow = {
  document_id: string;
  shared_by: string | null;
};

async function resolveWorkspaceNames(
  supabase: SupabaseClient,
  workspaceIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (workspaceIds.length === 0) return names;

  const { data, error } = await supabase.rpc("workspace_names_for_share_context", {
    ws_ids: workspaceIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    if (row.id && row.name) {
      names.set(row.id as string, row.name as string);
    }
  }

  return names;
}

async function resolveSharerDisplayNames(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;

  const { data, error } = await supabase.rpc("user_display_names_for_document_shares", {
    user_ids: userIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    if (row.id && row.display_name) {
      names.set(row.id as string, row.display_name as string);
    }
  }

  return names;
}

export async function fetchIncomingSharedDocuments(
  supabase: SupabaseClient,
  workspaceId: string,
  documentFields: string,
  options?: {
    userId?: string | null;
    /** User-targeted shares only appear in the viewer's personal scopes */
    includePersonalUserShares?: boolean;
  },
) {
  const incomingDocIds = new Set<string>();
  const incomingSharerByDoc = new Map<string, string>();
  const userId = options?.userId;
  const includePersonalUserShares = options?.includePersonalUserShares ?? false;

  const { data: incomingWorkspaceShares, error: workspaceSharesError } =
    await supabase
      .from("document_shares")
      .select("document_id, shared_by")
      .eq("grantee_type", "workspace")
      .eq("grantee_workspace_id", workspaceId);

  if (workspaceSharesError) {
    throw new Error(workspaceSharesError.message);
  }

  for (const row of incomingWorkspaceShares ?? []) {
    if (row.document_id) {
      incomingDocIds.add(row.document_id);
      if (row.shared_by) {
        incomingSharerByDoc.set(row.document_id, row.shared_by);
      }
    }
  }

  if (userId && includePersonalUserShares) {
    const { data: incomingUserShares, error: userSharesError } = await supabase
      .from("document_shares")
      .select("document_id, shared_by")
      .eq("grantee_type", "user")
      .eq("grantee_user_id", userId);

    if (userSharesError) {
      throw new Error(userSharesError.message);
    }

    for (const row of incomingUserShares ?? []) {
      if (row.document_id) {
        incomingDocIds.add(row.document_id);
        if (row.shared_by) {
          incomingSharerByDoc.set(row.document_id, row.shared_by);
        }
      }
    }
  }

  if (incomingDocIds.size === 0) {
    return { documents: [] as Record<string, unknown>[], incomingDocIds, incomingSharerByDoc };
  }

  const { data: incomingDocs, error: docsError } = await supabase
    .from("documents")
    .select(documentFields)
    .in("id", [...incomingDocIds])
    .neq("workspace_id", workspaceId)
    .or("metadata->template_draft.is.null,metadata->template_draft.eq.false");

  if (docsError) {
    throw new Error(docsError.message);
  }

  return { documents: incomingDocs ?? [], incomingDocIds, incomingSharerByDoc };
}

export async function attachShareContextToDocuments(
  supabase: SupabaseClient,
  workspaceId: string,
  documents: DocumentRow[],
  incomingDocIds: Set<string>,
  incomingSharerByDoc: Map<string, string>,
): Promise<Array<DocumentRow & { share_context: DocumentShareContext }>> {
  const docIds = documents.map((doc) => doc.id);
  const originWorkspaceIds = new Set<string>();

  let outgoingShares: ShareRow[] = [];
  if (docIds.length > 0) {
    const { data, error } = await supabase
      .from("document_shares")
      .select("document_id, grantee_type, grantee_workspace_id, label")
      .in("document_id", docIds);

    if (error) {
      throw new Error(error.message);
    }
    outgoingShares = (data ?? []) as ShareRow[];
  }

  for (const doc of documents) {
    if (doc.workspace_id) originWorkspaceIds.add(doc.workspace_id);
  }
  for (const share of outgoingShares) {
    if (share.grantee_workspace_id) originWorkspaceIds.add(share.grantee_workspace_id);
  }

  const workspaceNames = await resolveWorkspaceNames(supabase, [...originWorkspaceIds]);
  const sharerIds = [...new Set(incomingSharerByDoc.values())];
  const sharerNames = await resolveSharerDisplayNames(supabase, sharerIds);

  const outgoingByDoc = new Map<string, string[]>();
  for (const share of outgoingShares) {
    const list = outgoingByDoc.get(share.document_id) ?? [];
    const name =
      share.grantee_type === "workspace" && share.grantee_workspace_id
        ? workspaceNames.get(share.grantee_workspace_id) ?? share.label
        : share.label;
    if (!list.includes(name)) list.push(name);
    outgoingByDoc.set(share.document_id, list);
  }

  const merged = documents.map((doc) => {
    const isOrigin = doc.workspace_id === workspaceId;
    const sharedWith = outgoingByDoc.get(doc.id) ?? [];
    const isIncoming = incomingDocIds.has(doc.id) || doc.workspace_id !== workspaceId;
    const sharerId = incomingSharerByDoc.get(doc.id);

    const share_context: DocumentShareContext = {
      is_origin: isOrigin,
      is_incoming: isIncoming,
      has_outgoing: sharedWith.length > 0,
      shared_with: isOrigin ? sharedWith : [],
      shared_by_user:
        isIncoming && sharerId ? sharerNames.get(sharerId) ?? null : null,
    };

    return { ...doc, share_context };
  });

  return merged;
}

export async function enrichDocumentListForWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  workspaceDocuments: DocumentRow[],
  documentFields: string,
  options?: {
    userId?: string | null;
    includePersonalUserShares?: boolean;
  },
) {
  const { documents: incomingDocs, incomingDocIds, incomingSharerByDoc } =
    await fetchIncomingSharedDocuments(
      supabase,
      workspaceId,
      documentFields,
      options,
    );

  const existingIds = new Set(workspaceDocuments.map((doc) => doc.id));
  const mergedDocs = [
    ...workspaceDocuments,
    ...incomingDocs.filter(
      (doc) => !existingIds.has((doc as DocumentRow).id),
    ) as DocumentRow[],
  ];

  const enriched = await attachShareContextToDocuments(
    supabase,
    workspaceId,
    mergedDocs,
    incomingDocIds,
    incomingSharerByDoc,
  );

  return enriched.sort((a, b) => {
    const aUpdated = (a as { updated_at?: string }).updated_at ?? "";
    const bUpdated = (b as { updated_at?: string }).updated_at ?? "";
    return bUpdated.localeCompare(aUpdated);
  });
}

export async function resolveSharedByDisplayName(
  supabase: SupabaseClient,
  sharedByUserId: string | null | undefined,
): Promise<string | null> {
  if (!sharedByUserId) return null;
  const names = await resolveSharerDisplayNames(supabase, [sharedByUserId]);
  return names.get(sharedByUserId) ?? null;
}

export async function getDocumentShareContext(
  supabase: SupabaseClient,
  document: DocumentRow,
  activeWorkspaceId: string | null,
): Promise<DocumentShareContext> {
  if (!activeWorkspaceId) return emptyShareContext();

  const [enriched] = await attachShareContextToDocuments(
    supabase,
    activeWorkspaceId,
    [document],
    new Set(),
    new Map(),
  );

  return enriched?.share_context ?? emptyShareContext();
}

export { resolveWorkspaceNames, resolveSharerDisplayNames };
