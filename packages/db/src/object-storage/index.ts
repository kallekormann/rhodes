import type { SupabaseClient } from "@supabase/supabase-js";
import { allowLocalStorageFallback } from "@rhodes/shared/storage-env";
import { createAdminClient } from "../client";
import { CompositeObjectStorage } from "./composite-object-storage";
import { LocalFilesystemObjectStorage } from "./local-filesystem-object-storage";
import { SupabaseObjectStorage } from "./supabase-object-storage";
import type { RhodesObjectStorage } from "@rhodes/shared/storage-adapter";

export type StorageBackend = "supabase";

function resolveStorageBackend(): StorageBackend {
  const backend = process.env.RHODES_STORAGE_BACKEND?.trim() || "supabase";
  if (backend !== "supabase") {
    throw new Error(`Unsupported RHODES_STORAGE_BACKEND: ${backend}`);
  }
  return backend;
}

function wrapWithLocalFallback(primary: RhodesObjectStorage): RhodesObjectStorage {
  if (!allowLocalStorageFallback()) return primary;
  return new CompositeObjectStorage(
    primary,
    new LocalFilesystemObjectStorage(),
    allowLocalStorageFallback,
  );
}

export function createObjectStorage(client: SupabaseClient): RhodesObjectStorage {
  resolveStorageBackend();
  return wrapWithLocalFallback(new SupabaseObjectStorage(client));
}

export function createAdminObjectStorage(): RhodesObjectStorage {
  return createObjectStorage(createAdminClient());
}

export function createSessionObjectStorage(
  client: SupabaseClient,
): RhodesObjectStorage {
  return createObjectStorage(client);
}
