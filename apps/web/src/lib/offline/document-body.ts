import { extractPlainText } from "@/lib/documents/plain-text";

export function bodyRichness(
  content: Record<string, unknown> | null | undefined,
  content_plain: string | null | undefined,
): number {
  const plain = (content_plain ?? "").trim();
  const fromJson = extractPlainText(content ?? {}).trim();
  return Math.max(plain.length, fromJson.length);
}

export function plainTextFromBody(
  content: Record<string, unknown> | null | undefined,
  content_plain: string | null | undefined,
): string {
  const plain = (content_plain ?? "").trim();
  if (plain.length > 0) return plain;
  return extractPlainText(content ?? {}).trim();
}
