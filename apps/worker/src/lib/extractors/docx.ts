import { extractTextWithTika } from "../tika";
import { extractPlaintext } from "./markdown";
import type { ExtractedDocument, ExtractedSegment } from "./types";

const TIKA_TIMEOUT_MS = 60_000;

async function extractHtmlWithTika(
  bytes: Uint8Array,
  mimeType: string,
): Promise<string | null> {
  const tikaUrl = (process.env.TIKA_URL ?? "http://localhost:9998").replace(
    /\/$/,
    "",
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIKA_TIMEOUT_MS);

  try {
    const response = await fetch(`${tikaUrl}/tika`, {
      method: "PUT",
      headers: {
        Accept: "text/html",
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: Buffer.from(bytes),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.text()).replace(/\u0000/g, "");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** DOCX via Tika HTML heading walk, fallback to plain. */
export async function extractDocx(
  bytes: Uint8Array,
  mimeType: string,
): Promise<ExtractedDocument> {
  const html = await extractHtmlWithTika(bytes, mimeType);
  if (!html) {
    const plain = await extractTextWithTika(bytes, mimeType);
    const fallback = extractPlaintext(
      new TextEncoder().encode(plain),
      mimeType,
      "txt",
      "docx-tika-plain-fallback",
    );
    return { ...fallback, file_type: "docx" };
  }

  const headingPath: string[] = [];
  const segments: ExtractedSegment[] = [];
  let paragraphIndex = 0;
  let offset = 0;
  const fullParts: string[] = [];

  const tokenRe =
    /<(h([1-6]))[^>]*>([\s\S]*?)<\/\1>|<p[^>]*>([\s\S]*?)<\/p>|<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(html)) !== null) {
    const level = match[2] ? Number(match[2]) : null;
    const raw = match[3] ?? match[4] ?? match[5] ?? "";
    const text = stripTags(raw);
    if (!text) continue;

    if (level) {
      headingPath.length = level - 1;
      headingPath[level - 1] = text;
      segments.push({
        text,
        chunk_kind: "heading",
        char_offset_start: offset,
        char_offset_end: offset + text.length,
        citation: { heading_path: [...headingPath] },
        structure: {
          segment_index: segments.length,
          heading_level: level,
        },
      });
    } else {
      paragraphIndex += 1;
      segments.push({
        text,
        chunk_kind: match[5] ? "list" : "prose",
        char_offset_start: offset,
        char_offset_end: offset + text.length,
        citation: {
          heading_path: [...headingPath],
          paragraph_index: paragraphIndex,
        },
        structure: { segment_index: segments.length },
      });
    }
    fullParts.push(text);
    offset += text.length + 2;
  }

  if (segments.length === 0) {
    const plain = stripTags(html);
    const fallback = extractPlaintext(
      new TextEncoder().encode(plain),
      mimeType,
      "txt",
      "docx-tika-html-fallback",
    );
    return { ...fallback, file_type: "docx" };
  }

  return {
    file_type: "docx",
    mime_type: mimeType,
    extractor: "docx-tika-html",
    full_text: fullParts.join("\n\n"),
    segments,
  };
}
