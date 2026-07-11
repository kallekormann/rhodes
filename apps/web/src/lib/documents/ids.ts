const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDocumentId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function createBlockId(): string {
  return crypto.randomUUID();
}
