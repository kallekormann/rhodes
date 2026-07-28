/**
 * Object storage contract for library files, document images, avatars.
 * Dev Docker: Supabase Storage (file backend). VPS: S3-compatible via same adapter.
 */

export type StoragePutInput = {
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType?: string;
  upsert?: boolean;
};

export interface RhodesObjectStorage {
  put(input: StoragePutInput): Promise<void>;
  get(bucket: string, path: string): Promise<Uint8Array | null>;
  remove(bucket: string, paths: string[]): Promise<void>;
  signedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
  ): Promise<string | null>;
}
