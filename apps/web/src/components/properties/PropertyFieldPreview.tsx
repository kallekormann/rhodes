"use client";

import { SchemaFieldRow } from "@/components/properties/SchemaFieldRow";
import { previewValueForFieldType } from "@/components/properties/property-preview-utils";
import type { MetadataFieldType } from "@/lib/metadata/schemas";

type PropertyFieldPreviewProps = {
  label: string;
  fieldType: MetadataFieldType;
  options?: string[];
  unit?: string;
};

export function PropertyFieldPreview({
  label,
  fieldType,
  options = [],
  unit,
}: PropertyFieldPreviewProps) {
  if (!label.trim()) {
    return <p className="caption property-field-preview__hint">Preview appears when you add a label.</p>;
  }

  const schemaOptions =
    fieldType === "number" && unit
      ? { unit }
      : options.length > 0
        ? options
        : null;

  return (
    <div className="property-field-preview">
      <h5 className="props-list__section-title">Preview</h5>
      <dl className="props-list">
        <SchemaFieldRow
          field={{
            id: "preview",
            workspace_id: "",
            field_key: label,
            field_label: label,
            field_type: fieldType,
            options: schemaOptions,
            created_at: "",
          }}
          value={previewValueForFieldType(fieldType, options)}
          onChange={() => {}}
          preview
        />
      </dl>
    </div>
  );
}
