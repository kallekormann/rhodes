import { z } from "zod";
import {
  fieldKeyFromLabel,
  isReservedMetadataKey,
  type MetadataFieldType,
} from "@/lib/metadata/schemas";

export const metadataFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "select",
  "multi_select",
  "date",
  "date_range",
  "tags",
  "number",
  "url",
  "checkbox",
]);

export const createMetadataSchemaInput = z.object({
  workspace_id: z.string().uuid(),
  field_label: z.string().min(1).max(80),
  field_type: metadataFieldTypeSchema,
  field_key: z.string().min(1).max(48).optional(),
  options: z.array(z.string().min(1).max(80)).optional(),
});

export function normalizeCreateMetadataSchemaInput(
  input: z.infer<typeof createMetadataSchemaInput>,
) {
  const field_key = (input.field_key ?? fieldKeyFromLabel(input.field_label)).toLowerCase();

  if (isReservedMetadataKey(field_key)) {
    throw new Error(`"${field_key}" is a reserved property key`);
  }

  const needsOptions =
    input.field_type === "select" || input.field_type === "multi_select";

  if (needsOptions && (!input.options || input.options.length === 0)) {
    throw new Error("Select fields require at least one option");
  }

  return {
    workspace_id: input.workspace_id,
    field_label: input.field_label.trim(),
    field_key,
    field_type: input.field_type as MetadataFieldType,
    options: needsOptions ? input.options : null,
  };
}
