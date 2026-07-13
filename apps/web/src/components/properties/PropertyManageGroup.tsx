"use client";

import { Pencil, X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { PropertyManageRow } from "@/components/properties/PropertyManageRow";
import type { MetadataSchemaGroup } from "@/lib/metadata/schemas";
import {
  groupFieldAsSchemaField,
  readGroupFieldValue,
  readGroupInstances,
} from "@/lib/metadata/schemas";
import "./GroupInstanceSection.css";

type PropertyManageGroupProps = {
  group: MetadataSchemaGroup;
  metadata: Record<string, unknown> | null;
  onEdit?: () => void;
  onRemove?: () => void;
};

export function PropertyManageGroup({
  group,
  metadata,
  onEdit,
  onRemove,
}: PropertyManageGroupProps) {
  const instances = readGroupInstances(metadata, group.group_key);
  const displayInstance = instances[0] ?? {};

  return (
    <section className="props-group">
      <div className="props-group__header--manage">
        <h4 className="props-group__title">{group.group_label}</h4>
        <div className="props-group__actions">
          {onEdit && (
            <IconButton
              icon={Pencil}
              label={`Edit ${group.group_label}`}
              size="small"
              iconSize={14}
              onClick={onEdit}
            />
          )}
          {onRemove && (
            <IconButton
              icon={X}
              label={`Remove ${group.group_label}`}
              size="small"
              iconSize={14}
              onClick={onRemove}
            />
          )}
        </div>
      </div>
      <div className="props-group__fields">
        {group.fields.map((field) => (
          <PropertyManageRow
            key={field.id}
            field={groupFieldAsSchemaField(group, field)}
            value={readGroupFieldValue(displayInstance, field)}
          />
        ))}
      </div>
    </section>
  );
}
