"use client";

import { useMemo, useState } from "react";
import type { MetadataFieldValue, MetadataSchemaField } from "@/lib/metadata/schemas";
import { SchemaFieldRow } from "@/components/properties/SchemaFieldRow";
import { previewValueForFieldType } from "@/components/properties/property-preview-utils";
import { Button } from "@/components/Button";
import "./PropertyPresetRow.css";
import "./GroupInstanceSection.css";

type PreviewField = {
  id: string;
  field_label: string;
  field_type: MetadataSchemaField["field_type"];
  options?: string[] | unknown | null;
};

type PropertyPresetRowProps = {
  onAdd: () => void;
  onEdit: () => void;
  fields: PreviewField[];
  groupLabel?: string;
};

function toSchemaField(field: PreviewField): MetadataSchemaField {
  return {
    id: field.id,
    workspace_id: "",
    field_key: field.field_label,
    field_label: field.field_label,
    field_type: field.field_type,
    options: field.options,
    created_at: "",
  };
}

function PresetPreviewFields({ fields }: { fields: PreviewField[] }) {
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        fields.map((field) => {
          const options = Array.isArray(field.options)
            ? field.options.filter((item): item is string => typeof item === "string")
            : undefined;
          return [field.id, previewValueForFieldType(field.field_type, options)];
        }),
      ),
    [fields],
  );

  const [values, setValues] = useState<Record<string, MetadataFieldValue>>(initialValues);

  return (
    <dl className="props-list props-list--preset-preview">
      {fields.map((field) => (
        <SchemaFieldRow
          key={field.id}
          field={toSchemaField(field)}
          value={values[field.id] ?? null}
          onChange={(next) => setValues((current) => ({ ...current, [field.id]: next }))}
        />
      ))}
    </dl>
  );
}

export function PropertyPresetRow({
  onAdd,
  onEdit,
  fields,
  groupLabel,
}: PropertyPresetRowProps) {
  return (
    <div className="property-preset-row">
      {groupLabel && <h4 className="props-group__title">{groupLabel}</h4>}
      <PresetPreviewFields fields={fields} />
      <div className="property-preset-row__actions">
        <Button size="small" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button size="small" variant="secondary" onClick={onAdd}>
          Add
        </Button>
      </div>
    </div>
  );
}
