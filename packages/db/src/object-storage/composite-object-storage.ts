import type {
  RhodesObjectStorage,
  StoragePutInput,
} from "@rhodes/shared/storage-adapter";

export class CompositeObjectStorage implements RhodesObjectStorage {
  constructor(
    private readonly primary: RhodesObjectStorage,
    private readonly local: RhodesObjectStorage,
    private readonly useLocalFallback: () => boolean,
  ) {}

  async put(input: StoragePutInput): Promise<void> {
    try {
      await this.primary.put(input);
    } catch (error) {
      if (!this.useLocalFallback()) throw error;
      await this.local.put(input);
    }
  }

  async get(bucket: string, objectPath: string): Promise<Uint8Array | null> {
    const primaryBytes = await this.primary.get(bucket, objectPath);
    if (primaryBytes && primaryBytes.length > 0) return primaryBytes;
    if (!this.useLocalFallback()) return primaryBytes;
    return this.local.get(bucket, objectPath);
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    try {
      await this.primary.remove(bucket, paths);
    } catch {
      if (!this.useLocalFallback()) throw new Error("Failed to remove object from storage");
    }

    if (this.useLocalFallback()) {
      await this.local.remove(bucket, paths);
    }
  }

  async signedUrl(
    bucket: string,
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<string | null> {
    return this.primary.signedUrl(bucket, objectPath, expiresInSeconds);
  }
}
