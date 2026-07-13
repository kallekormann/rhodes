type ZodFlattenedError = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[]>;
};

function isZodFlattenedError(value: unknown): value is ZodFlattenedError {
  return (
    typeof value === "object" &&
    value !== null &&
    ("formErrors" in value || "fieldErrors" in value)
  );
}

export function parseApiErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (!data || typeof data !== "object") return fallback;

  const record = data as { error?: unknown; message?: unknown };

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  if (isZodFlattenedError(record.error)) {
    const formErrors = record.error.formErrors ?? [];
    const fieldErrors = Object.values(record.error.fieldErrors ?? {}).flat();
    const messages = [...formErrors, ...fieldErrors].filter(Boolean);
    if (messages.length > 0) return messages[0];
  }

  return fallback;
}
