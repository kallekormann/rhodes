"use client";

import { useCallback } from "react";
import type { DocumentRecord } from "@/hooks/useDocument";
import {
  buildOfflineCreateDocument,
  commitOfflineDocumentCreate,
} from "@/lib/offline/offline-document-mutations";
import { ensureDocsVaultUnlocked } from "@/lib/offline/offline-vault-session";
import { createLocalDocumentId } from "@/lib/offline/local-document";
import { notifyDocumentSyncStatus } from "@/lib/offline/sync-engine";

function offlineRecordToDocument(record: {
  id: string;
  workspace_id: string;
  title: string;
  content: Record<string, unknown> | null;
  content_plain: string | null;
  metadata?: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
}): DocumentRecord {
  return {
    id: record.id,
    workspace_id: record.workspace_id,
    title: record.title,
    content: record.content,
    content_plain: record.content_plain,
    metadata: record.metadata ?? null,
    updated_at: record.updated_at,
    created_at: record.created_at,
  };
}

/** Create documents without subscribing to the full documents list / sync lifecycle. */
export function useCreateDocument(
  workspaceId: string | null,
  userId: string | null | undefined,
  online: boolean,
) {
  const createDocument = useCallback(
    async (
      input?: {
        title?: string;
        template_id?: string;
        metadata?: Record<string, unknown>;
      },
      workspaceOverride?: string,
    ): Promise<DocumentRecord | null> => {
      const targetWorkspaceId = workspaceOverride ?? workspaceId;
      if (!targetWorkspaceId) return null;

      if (!online) {
        if (input?.template_id) {
          throw new Error("Templates require an internet connection");
        }
        if (!userId) {
          throw new Error("Cannot create document offline");
        }

        await ensureDocsVaultUnlocked(userId);
        const id = createLocalDocumentId();
        const { document, create } = await buildOfflineCreateDocument({
          id,
          workspaceId: targetWorkspaceId,
          title: input?.title,
          metadata: input?.metadata,
        });
        await commitOfflineDocumentCreate({ document, create });
        notifyDocumentSyncStatus(id, "pending");
        return offlineRecordToDocument(document);
      }

      const response = await fetch("/app/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: targetWorkspaceId,
          title: input?.title,
          template_id: input?.template_id,
          metadata: input?.metadata,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to create document",
        );
      }

      return data.document as DocumentRecord;
    },
    [workspaceId, online, userId],
  );

  return { createDocument };
}
