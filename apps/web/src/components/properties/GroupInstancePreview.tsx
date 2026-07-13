"use client";

import { SchemaFieldRow } from "@/components/properties/SchemaFieldRow";
import { previewValueForFieldType } from "@/components/properties/property-preview-utils";
import type { MetadataFieldType } from "@/lib/metadata/schemas";
import "./GroupInstanceSection.css";

type DraftField = {
  id: string;
  field_label: string;
  field_type: MetadataFieldType;
  options?: string[] | { unit: string } | null;
};

type GroupInstancePreviewProps = {
  groupLabel: string;
  fields: DraftField[];
};

export function GroupInstancePreview({ groupLabel, fields }: GroupInstancePreviewProps) {
  if (!groupLabel.trim() || fields.every((field) => !field.field_label.trim())) {
    return (
      <p className="caption property-field-preview__hint">Preview appears when you add a group name and sub-properties.</p>
    );
  }

  return (
    <div className="group-instance-preview">
      <h5 className="props-list__section-title">Preview</h5>
      <section className="props-group">
        <h4 className="props-group__title">{groupLabel}</h4>
        <dl className="props-list props-list--preset-preview">
          {fields
            .filter((field) => field.field_label.trim())
            .map((field) => {
              const options = Array.isArray(field.options)
                ? field.options.filter((item): item is string => typeof item === "string")
                : undefined;

              return (
                <SchemaFieldRow
                  key={field.id}
                  field={{
                    id: field.id,
                    workspace_id: "",
                    field_key: field.field_label,
                    field_label: field.field_label,
                    field_type: field.field_type,
                    options: field.options ?? null,
                    created_at: "",
                  }}
                  value={previewValueForFieldType(field.field_type, options)}
                  onChange={() => {}}
                  preview
                />
              );
            })}
        </dl>
      </section>
    </div>
  );
}
