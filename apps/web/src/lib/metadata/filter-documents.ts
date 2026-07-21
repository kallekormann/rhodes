import type { DocumentRecord } from "@/hooks/useDocument";
import {
  parseSchemaOptions,
  readUserMetadataValue,
  type MetadataSchemaField,
} from "@/lib/metadata/schemas";

/** Prefer seeded Status; else first top-level select with options. */
export function pickDocumentsFilterField(
  schemas: MetadataSchemaField[],
): MetadataSchemaField | null {
  const selects = schemas.filter(
    (field) =>
      !field.group_id &&
      field.field_type === "select" &&
      (parseSchemaOptions(field.options)?.length ?? 0) > 0,
  );
  return (
    selects.find((field) => field.field_key === "status") ?? selects[0] ?? null
  );
}

export function formatMetadataOptionLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function documentMatchesMetadataFilter(
  doc: DocumentRecord,
  fieldKey: string,
  selectedValue: string | null,
): boolean {
  if (!selectedValue) return true;
  return readUserMetadataValue(doc.metadata, fieldKey) === selectedValue;
}
