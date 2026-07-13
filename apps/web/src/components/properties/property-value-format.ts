import type { MetadataFieldValue, MetadataSchemaField } from "@/lib/metadata/schemas";
import { parseSchemaOptions, parseSchemaUnit } from "@/lib/metadata/schemas";

export function formatMetadataValueForDisplay(
  field: MetadataSchemaField,
  value: MetadataFieldValue,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const options = parseSchemaOptions(field.options);
  const unit = parseSchemaUnit(field.options);

  switch (field.field_type) {
    case "checkbox":
      return value === true ? "Yes" : "No";
    case "number":
      return typeof value === "number" ? `${value}${unit ? ` ${unit}` : ""}` : String(value);
    case "multi_select":
    case "tags":
      return Array.isArray(value) && value.length > 0
        ? value.map((item) => String(item).replace(/_/g, " ")).join(", ")
        : "—";
    case "select":
      return typeof value === "string" ? value.replace(/_/g, " ") : "—";
    case "date_range": {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const range = value as { start?: string | null; end?: string | null };
        const parts = [range.start, range.end].filter(Boolean);
        return parts.length > 0 ? parts.join(" → ") : "—";
      }
      return "—";
    }
    case "date":
      return typeof value === "string" ? value : "—";
    case "textarea":
    case "text":
    case "url":
      return typeof value === "string" ? value : "—";
    default:
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      if (typeof value === "boolean") {
        return value ? "Yes" : "No";
      }
      return String(value);
  }
}
