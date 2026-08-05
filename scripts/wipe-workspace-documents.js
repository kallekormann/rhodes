/**
 * Hard-delete all documents in a workspace for a clean test start.
 * Cascades versions, shares, activity, document_chunks, document_yjs_state.
 * Does NOT wipe library_sources, metadata_schemas, or view instance configs.
 *
 * Usage:
 *   pnpm db:wipe:docs -- --workspace-id=<uuid>
 *   pnpm db:wipe:docs -- --workspace-id=<uuid> --dry-run
 *   pnpm db:wipe:docs -- --workspace-id=<uuid> --reset-layouts
 *
 * Or env: SEED_WORKSPACE_ID / WIPE_WORKSPACE_ID
 *
 * After running: clear browser offline/synced cache (Settings) and hard refresh
 * so IndexedDB does not resurrect deleted docs.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function loadEnvFile() {
  const envPath = path.join(rootDir, "docker/.env");
  const content = await readFile(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

function parseArgs(argv) {
  const flags = {
    workspaceId: process.env.WIPE_WORKSPACE_ID || process.env.SEED_WORKSPACE_ID || null,
    dryRun: false,
    resetLayouts: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--reset-layouts") flags.resetLayouts = true;
    else if (arg.startsWith("--workspace-id=")) {
      flags.workspaceId = arg.slice("--workspace-id=".length).trim();
    }
  }
  return flags;
}

async function main() {
  await loadEnvFile();
  const { workspaceId, dryRun, resetLayouts } = parseArgs(process.argv.slice(2));

  if (!workspaceId) {
    throw new Error(
      "Required: --workspace-id=<uuid> or WIPE_WORKSPACE_ID / SEED_WORKSPACE_ID",
    );
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { enabled: false },
  });

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (wsError || !workspace) {
    throw wsError ?? new Error(`Workspace ${workspaceId} not found`);
  }

  const { count, error: countError } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (countError) throw countError;

  const docCount = count ?? 0;
  console.log(
    `${dryRun ? "[dry-run] " : ""}Workspace "${workspace.name}" (${workspaceId}): ${docCount} document(s)`,
  );

  if (dryRun) {
    if (resetLayouts) {
      console.log(
        "[dry-run] Would null mindmap/wiki layouts on scope_view_instances",
      );
    }
    console.log(
      "Note: document-images storage objects are not deleted by this script.",
    );
    return;
  }

  if (docCount > 0) {
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("workspace_id", workspaceId);
    if (deleteError) throw deleteError;
    console.log(`Deleted ${docCount} document(s).`);
  } else {
    console.log("No documents to delete.");
  }

  if (resetLayouts) {
    const { data: updated, error: layoutError } = await supabase
      .from("scope_view_instances")
      .update({ layout: null })
      .eq("workspace_id", workspaceId)
      .in("base_view_type", ["mindmap", "wiki"])
      .select("id");
    if (layoutError) throw layoutError;
    console.log(
      `Reset layouts on ${updated?.length ?? 0} mindmap/wiki view instance(s).`,
    );
  }

  console.log(
    "Done. Clear browser offline/synced cache (Settings) and hard refresh.",
  );
  console.log(
    "Note: document-images storage objects may remain as orphans.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
