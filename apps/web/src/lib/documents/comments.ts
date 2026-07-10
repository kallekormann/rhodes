export type StoredDocumentComment = {
  id: string;
  from: number;
  to: number;
  anchorText: string;
  text: string;
  author: string;
  createdAt: string;
};

const COMMENTS_KEY = "comments";

function isComment(value: unknown): value is StoredDocumentComment {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.from === "number" &&
    typeof record.to === "number" &&
    typeof record.anchorText === "string" &&
    typeof record.text === "string" &&
    typeof record.author === "string" &&
    typeof record.createdAt === "string"
  );
}

export function parseDocumentComments(
  metadata: Record<string, unknown> | null | undefined,
): StoredDocumentComment[] {
  const raw = metadata?.[COMMENTS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isComment);
}

export function withDocumentComments(
  metadata: Record<string, unknown> | null | undefined,
  comments: StoredDocumentComment[],
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [COMMENTS_KEY]: comments,
  };
}

export function createDocumentComment(input: {
  from: number;
  to: number;
  anchorText: string;
  text: string;
  author: string;
}): StoredDocumentComment {
  return {
    id: crypto.randomUUID(),
    from: input.from,
    to: input.to,
    anchorText: input.anchorText,
    text: input.text,
    author: input.author,
    createdAt: new Date().toISOString(),
  };
}
