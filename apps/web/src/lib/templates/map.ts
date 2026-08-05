import type { Template } from "@/data/templates";
import type { TemplateRecord } from "@/hooks/useTemplates";
import { parseTemplateMetadata } from "@/lib/templates/metadata";
import {
  resolveTemplateCategory,
  type TemplateCategoryId,
} from "@rhodes/shared/system-templates";

export function templateRecordToUi(template: TemplateRecord): Template {
  const description = template.description?.trim() ?? "";
  const metadata = parseTemplateMetadata(template.metadata);
  const slug =
    (typeof template.slug === "string" && template.slug.trim()) ||
    (typeof template.metadata?.slug === "string"
      ? template.metadata.slug.trim()
      : null);
  const category: TemplateCategoryId | null =
    resolveTemplateCategory(slug) ??
    (metadata.category as TemplateCategoryId | undefined) ??
    null;

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
    category,
    slug,
  };
}

export function pickOverviewTemplates(templates: TemplateRecord[], limit = 3) {
  const system = templates.filter((template) => template.is_system);
  const blank = system.filter(
    (template) =>
      template.name === "Blank" ||
      template.slug === "blank" ||
      (typeof template.metadata?.slug === "string" &&
        template.metadata.slug === "blank"),
  );
  const rest = system.filter((template) => !blank.includes(template));
  return [...blank, ...rest].slice(0, limit);
}
