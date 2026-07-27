/** Sentinel for documents created offline that have never been on the server. */
export const LOCAL_SERVER_UPDATED_AT = "";

export function isLocalOnlyDocument(record: {
  server_updated_at: string;
}): boolean {
  return record.server_updated_at === LOCAL_SERVER_UPDATED_AT;
}

export function createLocalDocumentId(): string {
  return crypto.randomUUID();
}
