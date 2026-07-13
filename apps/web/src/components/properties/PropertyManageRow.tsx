"use client";

import { Pencil, X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { formatMetadataValueForDisplay } from "@/components/properties/property-value-format";
import type { MetadataFieldValue, MetadataSchemaField } from "@/lib/metadata/schemas";
import "./PropertyManageRow.css";

type PropertyManageRowProps = {
  field: MetadataSchemaField;
  value: MetadataFieldValue;
  aiSuggested?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
};

export function PropertyManageRow({
  field,
  value,
  aiSuggested = false,
  onEdit,
  onRemove,
}: PropertyManageRowProps) {
  const hasActions = Boolean(onEdit || onRemove);

  return (
    <div className="property-manage-row">
      <div className="property-manage-row__header">
        <dt className="property-manage-row__label">
          {field.field_label}
          {aiSuggested && <span className="props-list__ai-hint">AI suggested</span>}
          {!aiSuggested && field.ai_fill_enabled && (
            <span className="props-list__ai-hint props-list__ai-hint--enabled">AI fill on</span>
          )}
        </dt>
        {hasActions && (
          <div className="property-manage-row__actions">
            {onEdit && (
              <IconButton
                icon={Pencil}
                label={`Edit ${field.field_label}`}
                size="small"
                iconSize={14}
                onClick={onEdit}
              />
            )}
            {onRemove && (
              <IconButton
                icon={X}
                label={`Remove ${field.field_label}`}
                size="small"
                iconSize={14}
                onClick={onRemove}
              />
            )}
          </div>
        )}
      </div>
      <dd className="property-manage-row__value">
        {formatMetadataValueForDisplay(field, value)}
      </dd>
    </div>
  );
}
