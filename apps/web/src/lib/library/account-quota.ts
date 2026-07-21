import type { SupabaseClient } from "@supabase/supabase-js";
import {
  libraryMaxFileBytes,
  libraryStorageLimitBytes,
  type BillingTier,
} from "@rhodes/shared/tiers";
import { createAdminClient } from "@rhodes/db";
import { resolveServerTier } from "@/lib/features/server-gates";

export type LibraryQuotaBreakdownItem = {
  workspace_id: string;
  name: string;
  used_bytes: number;
};

export type AccountLibraryQuota = {
  used_bytes: number;
  limit_bytes: number;
  max_file_bytes: number;
  tier: BillingTier;
  owned_workspace_count: number;
  breakdown: LibraryQuotaBreakdownItem[];
};

function byteSizeFromMetadata(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const raw = (metadata as { byte_size?: unknown }).byte_size;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Resolve the account that owns a workspace (role = owner). */
export async function resolveWorkspaceOwnerId(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (error || !data?.user_id) return null;
  return data.user_id as string;
}

/** Sum library file bytes across all workspaces owned by the account. */
export async function getAccountLibraryQuota(
  ownerUserId: string,
  tier: BillingTier = resolveServerTier(),
): Promise<AccountLibraryQuota> {
  const admin = createAdminClient();

  const { data: ownedRows, error: ownedError } = await admin
    .from("workspace_members")
    .select("workspace_id, workspaces!inner(id, name)")
    .eq("user_id", ownerUserId)
    .eq("role", "owner");

  if (ownedError) {
    throw new Error(ownedError.message);
  }

  const owned = (ownedRows ?? []).map((row) => {
    const workspace = row.workspaces as
      | { id?: string; name?: string }
      | { id?: string; name?: string }[]
      | null;
    const ws = Array.isArray(workspace) ? workspace[0] : workspace;
    return {
      workspace_id: (row.workspace_id as string) ?? ws?.id ?? "",
      name: ws?.name?.trim() || "Workspace",
    };
  }).filter((row) => row.workspace_id);

  const workspaceIds = owned.map((row) => row.workspace_id);
  const usedByWorkspace = new Map<string, number>(
    owned.map((row) => [row.workspace_id, 0]),
  );

  if (workspaceIds.length > 0) {
    const { data: sources, error: sourcesError } = await admin
      .from("library_sources")
      .select("workspace_id, metadata")
      .in("workspace_id", workspaceIds);

    if (sourcesError) {
      throw new Error(sourcesError.message);
    }

    for (const source of sources ?? []) {
      const wsId = source.workspace_id as string;
      const prev = usedByWorkspace.get(wsId) ?? 0;
      usedByWorkspace.set(wsId, prev + byteSizeFromMetadata(source.metadata));
    }
  }

  const breakdown: LibraryQuotaBreakdownItem[] = owned.map((row) => ({
    workspace_id: row.workspace_id,
    name: row.name,
    used_bytes: usedByWorkspace.get(row.workspace_id) ?? 0,
  }));

  const used_bytes = breakdown.reduce((sum, row) => sum + row.used_bytes, 0);

  return {
    used_bytes,
    limit_bytes: libraryStorageLimitBytes(tier),
    max_file_bytes: libraryMaxFileBytes(tier),
    tier,
    owned_workspace_count: owned.length,
    breakdown,
  };
}

export type QuotaCheckResult =
  | { ok: true; quota: AccountLibraryQuota; ownerUserId: string }
  | { ok: false; status: 400 | 403 | 500; error: string };

/**
 * Enforce max-file and account-owner storage against the workspace owner's tier.
 * Caller must already verify the uploader is a workspace member.
 */
export async function assertLibraryUploadAllowed(input: {
  workspaceId: string;
  uploaderUserId: string;
  fileSize: number;
}): Promise<QuotaCheckResult> {
  const admin = createAdminClient();

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id, is_team_workspace")
    .eq("id", input.workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const ownerUserId = await resolveWorkspaceOwnerId(admin, input.workspaceId);
  if (!ownerUserId) {
    return { ok: false, status: 500, error: "Workspace has no owner" };
  }

  // Until Phase 11 subscriptions, mock/dev tier applies; later resolve owner's subscription.
  const ownerTier = resolveServerTier();
  let quota: AccountLibraryQuota;
  try {
    quota = await getAccountLibraryQuota(ownerUserId, ownerTier);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load storage quota";
    return { ok: false, status: 500, error: message };
  }

  if (input.fileSize > quota.max_file_bytes) {
    const mb = Math.round(quota.max_file_bytes / (1024 * 1024));
    return {
      ok: false,
      status: 400,
      error: `File exceeds the ${mb} MB limit for this plan`,
    };
  }

  if (quota.used_bytes + input.fileSize > quota.limit_bytes) {
    const isTeam = Boolean(workspace.is_team_workspace);
    const uploaderIsOwner = input.uploaderUserId === ownerUserId;
    const error =
      isTeam && !uploaderIsOwner
        ? "This team's storage is full. Ask the team owner to free space or upgrade."
        : "Your library storage is full. Free space or upgrade in Settings.";
    return { ok: false, status: 400, error };
  }

  return { ok: true, quota, ownerUserId };
}
