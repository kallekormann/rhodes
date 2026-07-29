import { createAdminClient } from "@rhodes/db";

export type WorkspaceStorageReconciliation = {
  workspace_id: string;
  metadata_bytes: number;
  storage_bytes: number;
  source_count: number;
  object_count: number;
  drift_bytes: number;
};

export type LibrarySourceStorageDrift = {
  source_id: string;
  workspace_id: string;
  file_path: string;
  metadata_bytes: number;
  storage_bytes: number;
  drift_bytes: number;
  status: "ok" | "missing_object" | "missing_metadata" | "size_mismatch";
};

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

type ReconciliationRow = {
  workspace_id: string;
  metadata_bytes: unknown;
  storage_bytes: unknown;
  source_count: unknown;
  object_count: unknown;
  drift_bytes: unknown;
};

type DriftRow = {
  source_id: string;
  workspace_id: string;
  file_path: string;
  metadata_bytes: unknown;
  storage_bytes: unknown;
  drift_bytes: unknown;
  status: string;
};

export async function getWorkspaceStorageReconciliation(
  workspaceId?: string,
): Promise<WorkspaceStorageReconciliation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("library_storage_reconciliation", {
    p_workspace_id: workspaceId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ReconciliationRow[]).map((row) => ({
    workspace_id: String(row.workspace_id),
    metadata_bytes: toNumber(row.metadata_bytes),
    storage_bytes: toNumber(row.storage_bytes),
    source_count: toNumber(row.source_count),
    object_count: toNumber(row.object_count),
    drift_bytes: toNumber(row.drift_bytes),
  }));
}

export async function getLibrarySourceStorageDrift(
  workspaceId?: string,
): Promise<LibrarySourceStorageDrift[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("library_source_storage_drift", {
    p_workspace_id: workspaceId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DriftRow[]).map((row) => ({
    source_id: String(row.source_id),
    workspace_id: String(row.workspace_id),
    file_path: String(row.file_path),
    metadata_bytes: toNumber(row.metadata_bytes),
    storage_bytes: toNumber(row.storage_bytes),
    drift_bytes: toNumber(row.drift_bytes),
    status: row.status as LibrarySourceStorageDrift["status"],
  }));
}

export async function verifyLibraryStorageObject(
  filePath: string,
  expectedBytes: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_library_storage_object", {
    p_object_name: filePath,
    p_expected_bytes: expectedBytes,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function sumAccountStorageBytes(
  workspaceIds: string[],
): Promise<number> {
  if (workspaceIds.length === 0) return 0;

  const rows = await getWorkspaceStorageReconciliation();
  const idSet = new Set(workspaceIds);
  return rows
    .filter((row) => idSet.has(row.workspace_id))
    .reduce((sum, row) => sum + row.storage_bytes, 0);
}
