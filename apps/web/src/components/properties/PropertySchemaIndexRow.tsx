"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { METADATA_FIELD_TYPE_LABELS, type MetadataSchemaGroup } from "@/lib/metadata/schemas";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";
import "./PropertySchemaIndexRow.css";

type PropertySchemaIndexRowProps =
  | {
      kind: "field";
      schema: MetadataSchemaField;
      onRemove: () => void;
    }
  | {
      kind: "group";
      group: MetadataSchemaGroup;
      onRemove: () => void;
    };

function unitFromField(field: MetadataSchemaField | MetadataSchemaGroup["fields"][number]): string {
  if (field.options && typeof field.options === "object" && !Array.isArray(field.options)) {
    const unit = (field.options as { unit?: string }).unit;
    return typeof unit === "string" ? unit : "";
  }
  return "";
}

export function PropertySchemaIndexRow(props: PropertySchemaIndexRowProps) {
  const [expanded, setExpanded] = useState(false);

  if (props.kind === "field") {
    const { schema, onRemove } = props;
    return (
      <div className="property-schema-index-row">
        <div className="property-schema-index-row__main">
          <span className="property-schema-index-row__title">{schema.field_label}</span>
          <span className="property-schema-index-row__meta">
            {METADATA_FIELD_TYPE_LABELS[schema.field_type]}
          </span>
        </div>
        <Button size="small" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>
    );
  }

  const { group, onRemove } = props;
  const subSummary = group.fields
    .map((field) => {
      const unit = unitFromField(field);
      return unit ? `${field.field_label} · ${unit}` : field.field_label;
    })
    .join(" · ");

  return (
    <div className="property-schema-index-row property-schema-index-row--group">
      <div className="property-schema-index-row__header">
        <button
          type="button"
          className="property-schema-index-row__expand"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <div className="property-schema-index-row__main">
            <span className="property-schema-index-row__title">{group.group_label}</span>
            <span className="property-schema-index-row__meta">
              Group · {group.fields.length} sub-fields
              {group.repeatable ? " · repeatable" : ""}
            </span>
          </div>
        </button>
        <Button size="small" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>
      {(expanded || group.fields.length <= 3) && (
        <p className="property-schema-index-row__summary caption">{subSummary}</p>
      )}
    </div>
  );
}
