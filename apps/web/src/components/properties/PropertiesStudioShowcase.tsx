"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import type { MetadataFieldType } from "@/lib/metadata/schemas";
import { OptionChipEditor } from "@/components/properties/OptionChipEditor";
import { PropertyPresetRow } from "@/components/properties/PropertyPresetRow";
import { PropertySchemaIndexRow } from "@/components/properties/PropertySchemaIndexRow";
import { PropertyTypeChipPicker } from "@/components/properties/PropertyTypeChipPicker";
import { fieldPresetToPreviewFields } from "@/components/properties/property-preview-utils";
import { PROPERTY_PRESETS } from "@/lib/metadata/presets";
import "./PropertiesStudioShowcase.css";

const demoField = {
  id: "demo-status",
  workspace_id: "demo",
  field_key: "status",
  field_label: "Status",
  field_type: "select" as const,
  options: ["draft", "in_progress", "done"],
  created_at: "",
};

const demoGroup = {
  id: "demo-kpi",
  workspace_id: "demo",
  group_key: "kpi",
  group_label: "KPI",
  repeatable: true,
  sort_order: 0,
  created_at: "",
  fields: [
    {
      id: "demo-kpi-name",
      group_id: "demo-kpi",
      sub_key: "name",
      field_label: "Name",
      field_type: "text" as const,
      options: null,
      sort_order: 0,
    },
    {
      id: "demo-kpi-baseline",
      group_id: "demo-kpi",
      sub_key: "baseline",
      field_label: "Baseline",
      field_type: "number" as const,
      options: { unit: "%" },
      sort_order: 1,
    },
  ],
};

export function PropertiesStudioShowcase() {
  const [fieldType, setFieldType] = useState<MetadataFieldType>("date");
  const [options, setOptions] = useState(["draft", "in_progress", "done"]);

  return (
    <div className="properties-flyout-showcase">
      <div className="properties-flyout-showcase__zones">
        <div className="properties-flyout-showcase__zone properties-flyout-showcase__zone--panel">
          <span className="properties-flyout-showcase__zone-label">Properties panel</span>
          <span className="caption">352px · document values + workspace schema</span>
        </div>
        <div className="properties-flyout-showcase__zone properties-flyout-showcase__zone--flyout">
          <span className="properties-flyout-showcase__zone-label">Add flyout</span>
          <span className="caption">320px · pick preset or compose</span>
        </div>
      </div>

      <div className="sticker-subsection">
        <span className="sticker-subsection__label">Preset row (no card)</span>
        <PropertyPresetRow
          fields={fieldPresetToPreviewFields(PROPERTY_PRESETS[0])}
          onAdd={() => {}}
          onEdit={() => {}}
        />
      </div>

      <div className="sticker-subsection">
        <span className="sticker-subsection__label">Workspace schema index</span>
        <PropertySchemaIndexRow kind="field" schema={demoField} onRemove={() => {}} />
        <PropertySchemaIndexRow kind="group" group={demoGroup} onRemove={() => {}} />
      </div>

      <div className="sticker-subsection">
        <span className="sticker-subsection__label">Type chip picker (compose)</span>
        <PropertyTypeChipPicker value={fieldType} onChange={setFieldType} />
      </div>

      <div className="sticker-subsection">
        <span className="sticker-subsection__label">Option chip editor</span>
        <OptionChipEditor options={options} onChange={setOptions} />
      </div>

      <div className="sticker-subsection">
        <span className="sticker-subsection__label">Button hierarchy</span>
        <div className="sticker-row">
          <Button>Manage</Button>
        </div>
        <div className="sticker-row">
          <Button size="small" variant="secondary">
            Add
          </Button>
          <Button size="small" variant="ghost">
            Customize
          </Button>
          <Button size="small" variant="ghost">
            Remove
          </Button>
        </div>
        <div className="sticker-row">
          <Button variant="secondary">Cancel</Button>
          <Button>Save property</Button>
        </div>
      </div>
    </div>
  );
}
