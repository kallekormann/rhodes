import { shouldReembedContent } from "@rhodes/ai";
import { CONTENT_REEMBED_THRESHOLD } from "@rhodes/shared/constants";

export { shouldReembedContent };

export function shouldEnqueueDocumentEmbed(
  previousPlain: string | null | undefined,
  nextPlain: string | null | undefined,
): boolean {
  const before = previousPlain?.trim() ?? "";
  const after = nextPlain?.trim() ?? "";
  if (!after) return false;
  if (!before) return after.length >= 80;
  return shouldReembedContent(before, after, CONTENT_REEMBED_THRESHOLD);
}

export function shouldEnqueueMetadataExtraction(
  previousPlain: string | null | undefined,
  nextPlain: string | null | undefined,
): boolean {
  const before = previousPlain?.trim() ?? "";
  const after = nextPlain?.trim() ?? "";
  if (after.length < 120) return false;
  if (!before) return true;
  return shouldReembedContent(before, after, 0.08);
}
