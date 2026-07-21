/**
 * Encrypted Ask conversation CRUD (IndexedDB). Never syncs to the server.
 */

import { decryptJson, encryptJson } from "@/lib/offline/ask-vault";
import {
  getOfflineDB,
  type AskThreadMessage,
  type ConversationKind,
  type ConversationRecord,
} from "@/lib/offline/db";

export type PersistedAskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ConversationListItem = {
  id: string;
  title: string;
  preview: string;
  updated_at: string;
  created_at: string;
};

function titleFromMessages(messages: PersistedAskMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "New chat";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

function previewFromMessages(messages: PersistedAskMessage[]): string {
  const last = [...messages].reverse().find((m) => m.content.trim());
  if (!last) return "";
  const text = last.content.trim().replace(/\s+/g, " ");
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function countUserMessages(messages: PersistedAskMessage[]): number {
  return messages.filter((m) => m.role === "user" && m.content.trim()).length;
}

export async function listConversations(
  userId: string,
  workspaceId: string,
  kind: ConversationKind = "ask",
): Promise<ConversationListItem[]> {
  const db = await getOfflineDB();
  const rows = await db.getAllFromIndex("conversations", "by-workspace-kind", [
    userId,
    workspaceId,
    kind,
  ]);
  return rows
    .map((row) => ({
      id: row.id,
      title: row.title || "New chat",
      preview: row.preview || "",
      updated_at: row.updated_at,
      created_at: row.created_at,
    }))
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
}

export async function loadConversationMessages(
  conversationId: string,
): Promise<PersistedAskMessage[]> {
  const db = await getOfflineDB();
  const row = await db.get("conversations", conversationId);
  if (!row?.messages_enc) return [];
  return decryptJson<PersistedAskMessage[]>(row.messages_enc);
}

export async function saveConversation(params: {
  id: string;
  userId: string;
  workspaceId: string;
  kind?: ConversationKind;
  documentId?: string | null;
  messages: PersistedAskMessage[];
  createdAt?: string;
}): Promise<ConversationRecord> {
  const {
    id,
    userId,
    workspaceId,
    kind = "ask",
    documentId = null,
    messages,
    createdAt,
  } = params;

  const now = new Date().toISOString();
  const messages_enc = await encryptJson(messages);
  const db = await getOfflineDB();
  const existing = await db.get("conversations", id);

  const record: ConversationRecord = {
    id,
    user_id: userId,
    workspace_id: workspaceId,
    kind,
    document_id: documentId,
    title: titleFromMessages(messages),
    preview: previewFromMessages(messages),
    messages_enc,
    created_at: existing?.created_at ?? createdAt ?? now,
    updated_at: now,
  };

  await db.put("conversations", record);
  return record;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("conversations", conversationId);
}

/**
 * One-time: move v1 plaintext ask_threads into encrypted conversations, then delete legacy rows.
 */
export async function migrateLegacyAskThreads(
  userId: string,
  workspaceId: string,
): Promise<string | null> {
  const db = await getOfflineDB();
  if (!db.objectStoreNames.contains("ask_threads")) return null;

  const legacyId = `${userId}:${workspaceId}`;
  const legacy = await db.get("ask_threads", legacyId);
  if (!legacy?.messages?.length) {
    if (legacy) await db.delete("ask_threads", legacyId);
    return null;
  }

  const messages: PersistedAskMessage[] = legacy.messages.map(
    (m: AskThreadMessage) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }),
  );

  if (countUserMessages(messages) === 0) {
    await db.delete("ask_threads", legacyId);
    return null;
  }

  const id = crypto.randomUUID();
  await saveConversation({
    id,
    userId,
    workspaceId,
    messages,
    createdAt: legacy.updated_at,
  });
  await db.delete("ask_threads", legacyId);
  return id;
}
