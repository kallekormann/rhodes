export type TemplateMetadata = {
  use_cases?: string[];
  default_properties?: Record<string, string>;
};

export function parseTemplateMetadata(metadata: unknown): TemplateMetadata {
  if (!metadata || typeof metadata !== "object") return {};

  const record = metadata as Record<string, unknown>;
  const useCases = Array.isArray(record.use_cases)
    ? record.use_cases.filter((item): item is string => typeof item === "string")
    : undefined;

  let defaultProperties: Record<string, string> | undefined;
  if (record.default_properties && typeof record.default_properties === "object") {
    defaultProperties = {};
    for (const [key, value] of Object.entries(
      record.default_properties as Record<string, unknown>,
    )) {
      if (typeof value === "string") {
        defaultProperties[key] = value;
      }
    }
  }

  return {
    use_cases: useCases,
    default_properties: defaultProperties,
  };
}

export function buildTemplateMetadata(input: TemplateMetadata): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (input.use_cases && input.use_cases.length > 0) {
    metadata.use_cases = input.use_cases;
  }

  if (input.default_properties && Object.keys(input.default_properties).length > 0) {
    metadata.default_properties = input.default_properties;
  }

  return metadata;
}
