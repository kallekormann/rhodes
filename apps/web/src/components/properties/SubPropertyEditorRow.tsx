"use client";

import { X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { needsChoiceOptions, OptionChipEditor } from "@/components/properties/OptionChipEditor";
import { Toggle } from "@/components/Toggle";
import {
  METADATA_FIELD_TYPE_LABELS,
  type MetadataFieldType,
} from "@/lib/metadata/schemas";
import "./SubPropertyEditorRow.css";

const SUB_FIELD_TYPES: MetadataFieldType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "multi_select",
  "date",
  "tags",
  "url",
  "checkbox",
];

type SubPropertyEditorRowProps = {
  label: string;
  fieldType: MetadataFieldType;
  options: string[];
  unit: string;
  aiFillEnabled: boolean;
  onLabelChange: (value: string) => void;
  onFieldTypeChange: (value: MetadataFieldType) => void;
  onOptionsChange: (value: string[]) => void;
  onUnitChange: (value: string) => void;
  onAiFillEnabledChange: (value: boolean) => void;
  onRemove?: () => void;
};

export function SubPropertyEditorRow({
  label,
  fieldType,
  options,
  unit,
  aiFillEnabled,
  onLabelChange,
  onFieldTypeChange,
  onOptionsChange,
  onUnitChange,
  onAiFillEnabledChange,
  onRemove,
}: SubPropertyEditorRowProps) {
  return (
    <div className="sub-property-editor-row">
      <div className="sub-property-editor-row__main">
        <Input
          className="sub-property-editor-row__label"
          variant="plain"
          value={label}
          onChange={onLabelChange}
          placeholder="Label"
        />
        <Dropdown
          className="sub-property-editor-row__type"
          variant="plain"
          value={fieldType}
          options={SUB_FIELD_TYPES.map((type) => ({
            id: type,
            label: type === "checkbox" ? "Yes/No" : METADATA_FIELD_TYPE_LABELS[type],
          }))}
          onChange={(value) => onFieldTypeChange(value as MetadataFieldType)}
        />
        {fieldType === "number" && (
          <Input
            className="sub-property-editor-row__unit"
            variant="plain"
            value={unit}
            onChange={onUnitChange}
            placeholder="Unit"
          />
        )}
        {onRemove && (
          <IconButton
            className="sub-property-editor-row__remove"
            icon={X}
            label="Remove sub-property"
            size="small"
            iconSize={14}
            onClick={onRemove}
          />
        )}
      </div>
      {needsChoiceOptions(fieldType) && fieldType !== "checkbox" && (
        <OptionChipEditor options={options} onChange={onOptionsChange} />
      )}
      <Toggle
        className="sub-property-editor-row__ai-toggle"
        label="Enable AI suggestions"
        checked={aiFillEnabled}
        onChange={(event) => onAiFillEnabledChange(event.target.checked)}
      />
    </div>
  );
}
