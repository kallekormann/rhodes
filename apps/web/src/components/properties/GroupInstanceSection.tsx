"use client";

import { SchemaFieldRow } from "@/components/properties/SchemaFieldRow";
import type { MetadataFieldValue, MetadataSchemaGroup } from "@/lib/metadata/schemas";
import {
  groupFieldAsSchemaField,
  readGroupFieldValue,
  readGroupInstances,
} from "@/lib/metadata/schemas";
import "./GroupInstanceSection.css";

type GroupInstanceSectionProps = {
  group: MetadataSchemaGroup;
  metadata: Record<string, unknown> | null;
  onInstanceFieldChange: (
    groupKey: string,
    instanceIndex: number,
    subKey: string,
    value: MetadataFieldValue,
  ) => void;
};

export function GroupInstanceSection({
  group,
  metadata,
  onInstanceFieldChange,
}: GroupInstanceSectionProps) {
  const instances = readGroupInstances(metadata, group.group_key);
  const instance = instances[0] ?? {};

  return (
    <section className="props-group">
      <h4 className="props-group__title">{group.group_label}</h4>
      <dl className="props-list">
        {group.fields.map((field) => (
          <SchemaFieldRow
            key={field.id}
            field={groupFieldAsSchemaField(group, field)}
            value={readGroupFieldValue(instance, field)}
            onChange={(value) =>
              onInstanceFieldChange(group.group_key, 0, field.sub_key, value)
            }
          />
        ))}
      </dl>
    </section>
  );
}
