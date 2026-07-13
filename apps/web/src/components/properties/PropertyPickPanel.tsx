"use client";

import type { MetadataSchemaField, MetadataSchemaGroup } from "@/lib/metadata/schemas";
import { PROPERTY_GROUP_PRESETS } from "@/lib/metadata/group-presets";
import { PROPERTY_PRESETS } from "@/lib/metadata/presets";
import {
  fieldPresetToPreviewFields,
  groupPresetToPreviewFields,
} from "@/components/properties/property-preview-utils";
import { PropertyPresetRow } from "@/components/properties/PropertyPresetRow";
import { Button } from "@/components/Button";
import { PanelActionBar } from "@/components/PanelActionBar";
import "./PropertyPickPanel.css";

type PropertyPickPanelProps = {
  schemas: MetadataSchemaField[];
  groups: MetadataSchemaGroup[];
  onAddFieldPreset: (label: string) => void;
  onAddGroupPreset: (label: string) => void;
  onCustomizeFieldPreset: (label: string) => void;
  onCustomizeGroupPreset: (label: string) => void;
  onCreateCustomField: () => void;
  onCreateCustomGroup: () => void;
};

export function PropertyPickPanel({
  onAddFieldPreset,
  onAddGroupPreset,
  onCustomizeFieldPreset,
  onCustomizeGroupPreset,
  onCreateCustomField,
  onCreateCustomGroup,
}: PropertyPickPanelProps) {
  return (
    <>
      <div className="property-flyout__body overlay-scrollbar">
        <section className="property-pick__section">
          <h5 className="props-list__section-title">Fields</h5>
          {PROPERTY_PRESETS.map((preset) => (
            <PropertyPresetRow
              key={preset.label}
              fields={fieldPresetToPreviewFields(preset)}
              onAdd={() => onAddFieldPreset(preset.label)}
              onEdit={() => onCustomizeFieldPreset(preset.label)}
            />
          ))}
        </section>

        <section className="property-pick__section">
          <h5 className="props-list__section-title">Groups</h5>
          {PROPERTY_GROUP_PRESETS.map((preset) => (
            <PropertyPresetRow
              key={preset.group_label}
              groupLabel={preset.group_label}
              fields={groupPresetToPreviewFields(preset)}
              onAdd={() => onAddGroupPreset(preset.group_label)}
              onEdit={() => onCustomizeGroupPreset(preset.group_label)}
            />
          ))}
        </section>
      </div>

      <PanelActionBar
        end={
          <>
            <Button size="small" variant="secondary" onClick={onCreateCustomField}>
              Create custom property
            </Button>
            <Button size="small" variant="secondary" onClick={onCreateCustomGroup}>
              Create property group
            </Button>
          </>
        }
      />
    </>
  );
}
