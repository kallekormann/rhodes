import type { MetadataFieldType } from "@/lib/metadata/schemas";

export type PropertyGroupSubPreset = {
  field_label: string;
  field_type: MetadataFieldType;
  options?: string[];
  unit?: string;
  ai_fill_enabled?: boolean;
};

export type PropertyGroupPreset = {
  group_label: string;
  repeatable: boolean;
  fields: PropertyGroupSubPreset[];
};

export const PROPERTY_GROUP_PRESETS: PropertyGroupPreset[] = [
  {
    group_label: "KPI",
    repeatable: true,
    fields: [
      { field_label: "Name", field_type: "text" },
      { field_label: "Baseline", field_type: "number" },
      { field_label: "Expected lift", field_type: "number", unit: "%" },
    ],
  },
  {
    group_label: "Experiment",
    repeatable: false,
    fields: [
      { field_label: "Hypothesis", field_type: "textarea", ai_fill_enabled: true },
      {
        field_label: "Outcome",
        field_type: "select",
        options: ["pending", "success", "failed", "inconclusive"],
        ai_fill_enabled: true,
      },
      {
        field_label: "Confidence",
        field_type: "select",
        options: ["low", "medium", "high"],
        ai_fill_enabled: true,
      },
    ],
  },
  {
    group_label: "Review",
    repeatable: false,
    fields: [
      { field_label: "Reviewer", field_type: "text" },
      { field_label: "Review date", field_type: "date" },
      { field_label: "Approved", field_type: "checkbox" },
    ],
  },
  {
    group_label: "Decision",
    repeatable: false,
    fields: [
      {
        field_label: "Status",
        field_type: "select",
        options: ["proposed", "agreed", "rejected", "superseded"],
        ai_fill_enabled: true,
      },
      { field_label: "Stakeholders", field_type: "tags", ai_fill_enabled: true },
      { field_label: "Deadline", field_type: "date", ai_fill_enabled: true },
    ],
  },
];
