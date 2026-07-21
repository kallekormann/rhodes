import { extractTextWithTika } from "../tika";
import type { ExtractedDocument, ExtractedSegment } from "./types";

const ROWS_PER_CHUNK = 50;

/**
 * Spreadsheet extraction.
 * Prefers SheetJS when available; falls back to Tika plain text.
 */
export async function extractSpreadsheet(
  bytes: Uint8Array,
  mimeType: string,
  fileType: "xls" | "xlsx",
): Promise<ExtractedDocument> {
  try {
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(bytes, { type: "buffer" });
    const segments: ExtractedSegment[] = [];
    const sheetNames: string[] = [];
    let offset = 0;
    const fullParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      sheetNames.push(sheetName);
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = xlsx.utils.sheet_to_json<Array<string | number | boolean | null>>(
        sheet,
        { header: 1, defval: "" },
      ) as unknown as unknown[][];

      for (let start = 0; start < rows.length; start += ROWS_PER_CHUNK) {
        const end = Math.min(rows.length, start + ROWS_PER_CHUNK);
        const slice = rows.slice(start, end);
        const text = slice
          .map((row) =>
            (row as unknown[])
              .map((cell) => String(cell ?? "").trim())
              .filter(Boolean)
              .join("\t"),
          )
          .filter(Boolean)
          .join("\n")
          .trim();
        if (!text) continue;

        segments.push({
          text,
          chunk_kind: "sheet_rows",
          char_offset_start: offset,
          char_offset_end: offset + text.length,
          citation: {
            sheet_name: sheetName,
            row_range: { start: start + 1, end },
            heading_path: [sheetName],
          },
          structure: { segment_index: segments.length },
        });
        fullParts.push(`[Sheet: ${sheetName}]\n${text}`);
        offset += text.length + 2;
      }
    }

    if (segments.length > 0) {
      return {
        file_type: fileType,
        mime_type: mimeType,
        extractor: "xlsx-sheetjs",
        full_text: fullParts.join("\n\n"),
        segments,
        source_metadata: { sheet_names: sheetNames },
      };
    }
  } catch {
    // fall through to Tika
  }

  const text = await extractTextWithTika(bytes, mimeType);
  return {
    file_type: fileType,
    mime_type: mimeType,
    extractor: "spreadsheet-tika-plain-fallback",
    full_text: text,
    segments: [
      {
        text,
        chunk_kind: "sheet_rows",
        char_offset_start: 0,
        char_offset_end: text.length,
        citation: {
          sheet_name: "Unknown",
          heading_path: ["Unknown"],
        },
        structure: { segment_index: 0 },
      },
    ],
    source_metadata: { sheet_names: ["Unknown"] },
  };
}
