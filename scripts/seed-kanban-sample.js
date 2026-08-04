/**
 * Seeds a realistic set of Kanban-ready sample documents into a workspace, so the
 * Kanban view has something worth iterating against instead of an empty board.
 *
 * Usage:
 *   pnpm db:seed:kanban                       # seeds the dev user's private workspace
 *   SEED_WORKSPACE_ID=<uuid> pnpm db:seed:kanban   # seeds a specific existing scope
 *
 * Idempotent: running it again won't duplicate documents or the status field.
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

const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? "dev@rhodes.local";
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "devpassword123";

const STATUS_FIELD_KEY = "feature_status";
const STATUS_OPTIONS = [
  { value: "idea", label: "Idea", category: "unstarted" },
  { value: "planned", label: "Planned", category: "unstarted" },
  { value: "building", label: "Building", category: "started" },
  { value: "shipped", label: "Shipped", category: "completed" },
  { value: "deprecated", label: "Deprecated", category: "canceled" },
];

const SEED_MARKER = "kanban-sample-v1";

const SAMPLE_DOCUMENTS = [
  { title: "Inline comments on shared docs", status: "idea", summary: "Let reviewers leave threaded comments anchored to a text selection." },
  { title: "Bulk template migration tool", status: "idea", summary: "Move existing documents to a newer template version in one pass." },
  { title: "Offline-first mobile capture", status: "planned", summary: "Draft on a phone with no connection, sync when back online." },
  { title: "Scope-level activity digest", status: "planned", summary: "Weekly summary email of what changed across a scope." },
  { title: "Keyboard-only command palette", status: "building", summary: "Cmd+K launcher for navigation, search, and quick actions." },
  { title: "Relation field picker redesign", status: "building", summary: "Faster document-to-document linking with inline previews." },
  { title: "Public read-only share links", status: "building", summary: "Share a document outside the workspace without an account." },
  { title: "Metadata schema versioning", status: "shipped", summary: "Track and roll back changes to a scope's property definitions." },
  { title: "Dark mode for the editor", status: "shipped", summary: "Full theme parity between the editor and the app shell." },
  { title: "Legacy CSV import wizard", status: "deprecated", summary: "Superseded by the structured template importer." },
];

async function main() {
  await loadEnvFile();

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { enabled: false },
  });

  const { workspaceId, userId } = await resolveWorkspace(supabase);
  console.log(`Seeding Kanban sample data into workspace ${workspaceId}`);

  await ensureStatusField(supabase, workspaceId);
  await ensureKanbanEnabled(supabase, workspaceId);
  await ensureKanbanInstance(supabase, workspaceId);
  await ensureSampleDocuments(supabase, workspaceId, userId);

  console.log("Kanban sample data ready.");
}

async function resolveWorkspace(supabase) {
  const explicitWorkspaceId = process.env.SEED_WORKSPACE_ID;
  if (explicitWorkspaceId) {
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", explicitWorkspaceId)
      .maybeSingle();
    if (error || !workspace) {
      throw error ?? new Error(`Workspace ${explicitWorkspaceId} not found`);
    }

    const { data: member } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", explicitWorkspaceId)
      .limit(1)
      .maybeSingle();

    return { workspaceId: explicitWorkspaceId, userId: member?.user_id ?? null };
  }

  const existing = await supabase.auth.admin.listUsers();
  let userId = existing.data.users.find((user) => user.email === SEED_EMAIL)?.id;

  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error("Failed to create seed user");
    }
    userId = created.data.user.id;
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1);

  let workspaceId = memberships?.[0]?.workspace_id;

  if (!workspaceId) {
    const workspace = await supabase
      .from("workspaces")
      .insert({ name: "Private", is_team_workspace: false })
      .select("id")
      .single();
    if (workspace.error || !workspace.data) {
      throw workspace.error ?? new Error("Failed to create workspace");
    }
    workspaceId = workspace.data.id;

    const member = await supabase
      .from("workspace_members")
      .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
    if (member.error) throw member.error;
  }

  return { workspaceId, userId };
}

async function ensureStatusField(supabase, workspaceId) {
  const { data: existingStatusField } = await supabase
    .from("metadata_schemas")
    .select("id, field_key")
    .eq("workspace_id", workspaceId)
    .eq("field_type", "status")
    .limit(1)
    .maybeSingle();

  if (existingStatusField) {
    console.log(`Reusing existing status field "${existingStatusField.field_key}"`);
    STATUS_FIELD_KEY_RESOLVED.value = existingStatusField.field_key;
    return;
  }

  const { error } = await supabase.from("metadata_schemas").insert({
    workspace_id: workspaceId,
    field_key: STATUS_FIELD_KEY,
    field_label: "Feature status",
    field_type: "status",
    options: STATUS_OPTIONS,
    ai_fill_enabled: false,
  });
  if (error) throw error;
  console.log(`Created status field "${STATUS_FIELD_KEY}"`);
}

// Mutable so ensureSampleDocuments can pick up a pre-existing field key discovered above.
const STATUS_FIELD_KEY_RESOLVED = { value: STATUS_FIELD_KEY };

async function ensureKanbanEnabled(supabase, workspaceId) {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("enabled_views")
    .eq("id", workspaceId)
    .single();
  if (error) throw error;

  if (workspace.enabled_views?.includes("kanban")) return;

  const nextViews = [...(workspace.enabled_views ?? []), "kanban"];
  const { error: updateError } = await supabase
    .from("workspaces")
    .update({ enabled_views: nextViews })
    .eq("id", workspaceId);
  if (updateError) throw updateError;
  console.log('Enabled "kanban" view for this workspace');
}

async function ensureKanbanInstance(supabase, workspaceId) {
  const { data: existing } = await supabase
    .from("scope_view_instances")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("base_view_type", "kanban")
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("scope_view_instances").insert({
    workspace_id: workspaceId,
    base_view_type: "kanban",
    label: "Kanban",
    config: { groupByField: STATUS_FIELD_KEY_RESOLVED.value },
    position: 0,
  });
  if (error) throw error;
  console.log("Created Kanban view instance");
}

async function ensureSampleDocuments(supabase, workspaceId, userId) {
  const { data: existingSample } = await supabase
    .from("documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .contains("metadata", { seed_source: SEED_MARKER })
    .limit(1);

  if (existingSample?.length) {
    console.log("Sample Kanban documents already exist, skipping");
    return;
  }

  const fieldKey = STATUS_FIELD_KEY_RESOLVED.value;
  const rows = SAMPLE_DOCUMENTS.map((doc) => ({
    workspace_id: workspaceId,
    created_by: userId,
    title: doc.title,
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: doc.summary }] }],
    },
    content_plain: doc.summary,
    metadata: { [fieldKey]: doc.status, seed_source: SEED_MARKER },
  }));

  const { error } = await supabase.from("documents").insert(rows);
  if (error) throw error;
  console.log(`Inserted ${rows.length} sample Kanban documents`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
