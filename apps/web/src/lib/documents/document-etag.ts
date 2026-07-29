/** Strong ETag for document metadata — keyed on `updated_at`. */
export function documentMetadataEtag(updatedAt: string): string {
  return `"${updatedAt}"`;
}

export function ifNoneMatchSatisfied(
  ifNoneMatch: string | null,
  etag: string,
): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((token) => token.trim() === etag);
}
