"use client";

import {
  Calendar,
  CalendarRange,
  CheckSquare,
  Hash,
  Link2,
  List,
  ListChecks,
  Tags,
  Text,
  AlignLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MetadataFieldType } from "@/lib/metadata/schemas";
import { METADATA_FIELD_TYPE_LABELS } from "@/lib/metadata/schemas";
import "./PropertyTypeChipPicker.css";

type TypeChip = {
  type: MetadataFieldType;
  icon: LucideIcon;
  label: string;
};

const TYPE_GROUPS: Array<{ title: string; chips: TypeChip[] }> = [
  {
    title: "Text",
    chips: [
      { type: "text", icon: Text, label: METADATA_FIELD_TYPE_LABELS.text },
      { type: "textarea", icon: AlignLeft, label: METADATA_FIELD_TYPE_LABELS.textarea },
      { type: "url", icon: Link2, label: METADATA_FIELD_TYPE_LABELS.url },
    ],
  },
  {
    title: "Number",
    chips: [{ type: "number", icon: Hash, label: METADATA_FIELD_TYPE_LABELS.number }],
  },
  {
    title: "Choice",
    chips: [
      { type: "select", icon: List, label: METADATA_FIELD_TYPE_LABELS.select },
      { type: "multi_select", icon: ListChecks, label: METADATA_FIELD_TYPE_LABELS.multi_select },
      { type: "checkbox", icon: CheckSquare, label: "Yes/No" },
    ],
  },
  {
    title: "Date",
    chips: [
      { type: "date", icon: Calendar, label: METADATA_FIELD_TYPE_LABELS.date },
      { type: "date_range", icon: CalendarRange, label: METADATA_FIELD_TYPE_LABELS.date_range },
    ],
  },
  {
    title: "Other",
    chips: [{ type: "tags", icon: Tags, label: METADATA_FIELD_TYPE_LABELS.tags }],
  },
];

type PropertyTypeChipPickerProps = {
  value: MetadataFieldType;
  onChange: (value: MetadataFieldType) => void;
};

export function PropertyTypeChipPicker({ value, onChange }: PropertyTypeChipPickerProps) {
  return (
    <div className="property-type-chip-picker">
      {TYPE_GROUPS.map((group) => (
        <div key={group.title} className="property-type-chip-picker__group">
          <span className="property-type-chip-picker__label">{group.title}</span>
          <div className="property-type-chip-picker__chips">
            {group.chips.map((chip) => {
              const Icon = chip.icon;
              const active = value === chip.type;
              return (
                <button
                  key={chip.type}
                  type="button"
                  className={`property-type-chip-picker__chip ${active ? "property-type-chip-picker__chip--active" : ""}`}
                  onClick={() => onChange(chip.type)}
                  aria-pressed={active}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
