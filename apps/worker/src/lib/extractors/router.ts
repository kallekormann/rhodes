import type { LibraryFileType } from "@rhodes/shared/chunk-metadata";
import { extractDocx } from "./docx";
import { extractMarkdown, extractPlaintext } from "./markdown";
import { extractPdf } from "./pdf";
import { extractPresentation } from "./presentation";
import { extractSpreadsheet } from "./spreadsheet";
import type { ExtractedDocument } from "./types";

const EXT_TO_TYPE: Record<string, LibraryFileType> = {
  pdf: "pdf",
  docx: "docx",
  ppt: "ppt",
  pptx: "pptx",
  xls: "xls",
  xlsx: "xlsx",
  rtf: "rtf",
  txt: "txt",
  md: "md",
  markdown: "md",
};

export function resolveLibraryFileType(
  mimeType: string,
  fileName?: string | null,
): LibraryFileType {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  if (ext && EXT_TO_TYPE[ext]) return EXT_TO_TYPE[ext];

  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("wordprocessingml") || mimeType.includes("msword"))
    return "docx";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return mimeType.includes("presentationml") ? "pptx" : "ppt";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return mimeType.includes("sheet") ? "xlsx" : "xls";
  if (mimeType.includes("rtf")) return "rtf";
  if (mimeType.includes("markdown")) return "md";
  return "txt";
}

export async function extractLibraryDocument(
  bytes: Uint8Array,
  mimeType: string,
  fileName?: string | null,
): Promise<ExtractedDocument> {
  const fileType = resolveLibraryFileType(mimeType, fileName);

  switch (fileType) {
    case "md":
      return extractMarkdown(bytes, mimeType || "text/markdown");
    case "txt":
      return extractPlaintext(bytes, mimeType || "text/plain", "txt", "plaintext");
    case "rtf":
      return extractPlaintext(bytes, mimeType || "application/rtf", "rtf", "rtf-plain-fallback");
    case "pdf":
      return extractPdf(bytes, mimeType);
    case "docx":
      return extractDocx(bytes, mimeType);
    case "ppt":
    case "pptx":
      return extractPresentation(bytes, mimeType, fileType);
    case "xls":
    case "xlsx":
      return extractSpreadsheet(bytes, mimeType, fileType);
    default:
      return extractPlaintext(bytes, mimeType, "txt", "plaintext-fallback");
  }
}
