import type { DocumentActivityEventType } from "./activity";

export function buildContentEditExcerpt(
  previousPlain: string | null | undefined,
  nextPlain: string | null | undefined,
): string | null {
  const prev = previousPlain?.trim() ?? "";
  const next = nextPlain?.trim() ?? "";
  if (!next || prev === next) return null;

  if (!prev) {
    return next.slice(0, 160);
  }

  let prefix = 0;
  const maxPrefix = Math.min(prev.length, next.length);
  while (prefix < maxPrefix && prev[prefix] === next[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  const maxSuffix = Math.min(prev.length - prefix, next.length - prefix);
  while (
    suffix < maxSuffix &&
    prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const changed = next.slice(prefix, next.length - suffix).trim();
  if (changed.length > 0) {
    return changed.slice(0, 160);
  }

  return next.slice(0, 160);
}

export function isSystemMetadataKey(key: string): boolean {
  if (key.startsWith("_")) return true;
  const systemKeys = new Set([
    "favorite",
    "archived",
    "archived_at",
    "template_draft",
    "comments",
    "template_description",
    "word_count",
    "summary",
  ]);
  return systemKeys.has(key);
}

export type SchemaLabelLookup = Map<string, string>;

export function resolveMetadataFieldLabel(
  fieldKey: string,
  labels: SchemaLabelLookup,
): string {
  return labels.get(fieldKey) ?? fieldKey.replace(/_/g, " ");
}

export function formatActivityPayloadDetail(
  eventType: DocumentActivityEventType,
  payload: Record<string, unknown>,
): string | null {
  switch (eventType) {
    case "property_changed": {
      const label =
        typeof payload.field_label === "string" ? payload.field_label : "Property";
      const from = payload.from;
      const to = payload.to;
      if (from !== undefined && to !== undefined) {
        return `${label}: ${formatValue(from)} → ${formatValue(to)}`;
      }
      return label;
    }
    case "title_changed":
      return typeof payload.title === "string"
        ? `Renamed to “${payload.title}”`
        : null;
    case "comment_added":
      return typeof payload.excerpt === "string" && payload.excerpt.trim()
        ? `“${payload.excerpt.trim()}”`
        : null;
    case "content_edited":
      return typeof payload.excerpt === "string" && payload.excerpt.trim()
        ? `“${payload.excerpt.trim()}”`
        : "Document content updated";
    case "shared_with":
      return typeof payload.target === "string"
        ? `Shared with ${payload.target}`
        : null;
    case "share_removed":
      return typeof payload.target === "string"
        ? `Removed share for ${payload.target}`
        : null;
    case "version_restored":
      return "Restored a previous version";
    default:
      return null;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("start" in record || "end" in record) {
      const start = record.start ?? "—";
      const end = record.end ?? "—";
      return `${start} → ${end}`;
    }
  }
  return JSON.stringify(value);
}
