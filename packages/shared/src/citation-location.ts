import type { CitationFacet, LibraryFileType } from "./chunk-metadata";

/** Format a user-facing citation location; never mixes incompatible locators. */
export function formatCitationLocation(
  fileType: LibraryFileType | string | null | undefined,
  citation: Partial<CitationFacet> | null | undefined,
): string {
  if (!citation) return "";

  const parts: string[] = [];
  const type = (fileType ?? "").toLowerCase();

  if (type === "pdf" && citation.page_number != null) {
    parts.push(`p.${citation.page_number}`);
  }

  if ((type === "ppt" || type === "pptx") && citation.slide_number != null) {
    parts.push(`Slide ${citation.slide_number}`);
  }

  if ((type === "xls" || type === "xlsx") && citation.sheet_name) {
    parts.push(`Sheet "${citation.sheet_name}"`);
    if (citation.row_range) {
      parts.push(`rows ${citation.row_range.start}–${citation.row_range.end}`);
    }
  }

  const heading =
    citation.heading_path && citation.heading_path.length > 0
      ? citation.heading_path[citation.heading_path.length - 1]
      : null;
  if (heading && type !== "ppt" && type !== "pptx") {
    parts.push(`§${heading}`);
  } else if (heading && (type === "ppt" || type === "pptx") && !citation.slide_number) {
    parts.push(`"${heading}"`);
  } else if (heading && (type === "ppt" || type === "pptx")) {
    parts.push(`"${heading}"`);
  }

  if (
    citation.paragraph_index != null &&
    type !== "ppt" &&
    type !== "pptx" &&
    type !== "xls" &&
    type !== "xlsx"
  ) {
    parts.push(`¶${citation.paragraph_index}`);
  }

  if (citation.line_range && (type === "md" || type === "txt" || type === "rtf")) {
    parts.push(`L${citation.line_range.start}–${citation.line_range.end}`);
  }

  if (citation.label?.trim() && parts.length === 0) {
    return citation.label.trim();
  }

  return parts.join(" · ");
}

/** Short label for Ask reasoning ticker (max ~80 chars). */
export function formatReasoningLabel(
  title: string,
  excerpt: string,
  citationLabel: string,
  maxLength = 80,
): string {
  const base = citationLabel
    ? `${title.trim() || "Source"} — ${citationLabel}`
    : title.trim() || "Source";
  if (base.length <= maxLength) return base;

  const room = Math.max(20, maxLength - 12);
  const hint = excerpt.replace(/\s+/g, " ").trim().slice(0, room);
  return `${(title.trim() || "Source").slice(0, 24)} — ${hint}…`;
}
