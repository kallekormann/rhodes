import type { Template } from "@/data/templates";
import type { TemplateRecord } from "@/hooks/useTemplates";
import { parseTemplateMetadata } from "@/lib/templates/metadata";

export function templateRecordToUi(template: TemplateRecord): Template {
  const description = template.description?.trim() ?? "";
  const metadata = parseTemplateMetadata(template.metadata);
  const useCases =
    metadata.use_cases && metadata.use_cases.length > 0
      ? metadata.use_cases
      : template.is_system
        ? ["Workspace documents"]
        : ["Custom template"];

  const properties = metadata.default_properties
    ? Object.entries(metadata.default_properties)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([label, value]) => ({
          label,
          value: Array.isArray(value)
            ? value.join(", ")
            : typeof value === "object" && value !== null
              ? "document_id" in value
                ? String(value.title ?? "Linked document")
                : [value.start, value.end].filter(Boolean).join(" → ")
              : String(value),
        }))
    : undefined;

  return {
    id: template.id,
    name: template.name,
    shortDescription: description || "No description",
    fullDescription: description || "No description",
    useCases,
    properties,
    mine: !template.is_system,
  };
}

export function pickOverviewTemplates(templates: TemplateRecord[], limit = 3) {
  const system = templates.filter((template) => template.is_system);
  return system.slice(0, limit);
}
