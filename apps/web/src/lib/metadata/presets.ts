import type { MetadataFieldType } from "@/lib/metadata/schemas";

export type PropertyPreset = {
  label: string;
  field_type: MetadataFieldType;
  options?: string[];
  ai_fill_enabled?: boolean;
};

export const PROPERTY_PRESETS: PropertyPreset[] = [
  {
    label: "Status",
    field_type: "select",
    options: ["draft", "in_progress", "review", "done", "archived"],
    ai_fill_enabled: true,
  },
  {
    label: "Priority",
    field_type: "select",
    options: ["low", "medium", "high", "urgent"],
  },
  {
    label: "Document type",
    field_type: "select",
    options: [
      "spec",
      "meeting_notes",
      "research",
      "experiment",
      "plan",
      "decision",
      "weekly_review",
    ],
    ai_fill_enabled: true,
  },
  { label: "Summary", field_type: "textarea", ai_fill_enabled: true },
  { label: "Tags", field_type: "tags", ai_fill_enabled: true },
  { label: "Due date", field_type: "date", ai_fill_enabled: true },
  { label: "Timeline", field_type: "date_range" },
  { label: "Review date", field_type: "date" },
  { label: "Project", field_type: "text" },
  {
    label: "Decision status",
    field_type: "select",
    options: ["proposed", "agreed", "rejected", "superseded"],
    ai_fill_enabled: true,
  },
  {
    label: "Experiment outcome",
    field_type: "select",
    options: ["pending", "success", "failed", "inconclusive"],
  },
  {
    label: "Confidence",
    field_type: "select",
    options: ["low", "medium", "high"],
    ai_fill_enabled: true,
  },
];
