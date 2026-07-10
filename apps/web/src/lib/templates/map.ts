import type { Template } from "@/data/templates";
import type { TemplateRecord } from "@/hooks/useTemplates";

export function templateRecordToUi(template: TemplateRecord): Template {
  const description = template.description?.trim() ?? "";
  return {
    id: template.id,
    name: template.name,
    shortDescription: description || "No description",
    fullDescription: description || "No description",
    useCases: template.is_system ? ["Workspace documents"] : ["Custom template"],
    mine: !template.is_system,
  };
}

export function pickOverviewTemplates(templates: TemplateRecord[], limit = 3) {
  const system = templates.filter((template) => template.is_system);
  return system.slice(0, limit);
}
