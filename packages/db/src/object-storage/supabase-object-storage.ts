import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RhodesObjectStorage,
  StoragePutInput,
} from "@rhodes/shared/storage-adapter";

export class SupabaseObjectStorage implements RhodesObjectStorage {
  constructor(private readonly client: SupabaseClient) {}

  async put(input: StoragePutInput): Promise<void> {
    const { error } = await this.client.storage
      .from(input.bucket)
      .upload(input.path, input.bytes, {
        contentType: input.contentType,
        upsert: input.upsert ?? false,
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  async get(bucket: string, path: string): Promise<Uint8Array | null> {
    const { data, error } = await this.client.storage.from(bucket).download(path);
    if (error || !data) return null;

    const bytes = new Uint8Array(await data.arrayBuffer());
    return bytes.length > 0 ? bytes : null;
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error) {
      throw new Error(error.message);
    }
  }

  async signedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
  ): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }
}
