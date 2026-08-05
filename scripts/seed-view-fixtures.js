/**
 * Seeds a small fixture set for Dashboard / Gantt / Knowledge Graph / collab UAT.
 *
 * Usage:
 *   SEED_WORKSPACE_ID=<uuid> pnpm db:seed:views
 *   pnpm db:seed:views   # seeds the default seed user's private workspace
 *
 * Idempotent via metadata.seed_source = view-fixtures-v1
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const SEED_MARKER = "view-fixtures-v1";
const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? "rhodes-tester@rhodes.com";
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "52553K0rmann!";

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

function plainDoc(...paragraphs) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}

function citationBlock(librarySourceId, title) {
  return {
    type: "citation",
    attrs: {
      sourceId: librarySourceId,
      sourceRefId: librarySourceId,
      originType: "library",
      sourceTitle: title,
      page: null,
      excerpt: "Fixture citation for Knowledge Graph edges.",
      locationLabel: "",
      locationMetadata: null,
    },
  };
}

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
  console.log(`Seeding view fixtures into workspace ${workspaceId}`);

  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .contains("metadata", { seed_source: SEED_MARKER })
    .limit(1);
  if (existing?.length) {
    console.log("View fixtures already exist, skipping");
    return;
  }

  await ensureViewsEnabled(supabase, workspaceId);
  await ensureSchemaFields(supabase, workspaceId);

  const { data: librarySource } = await supabase
    .from("library_sources")
    .select("id, file_name")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();

  const insightId = crypto.randomUUID();
  const problemId = crypto.randomUUID();
  const experimentId = crypto.randomUUID();
  const ticketId = crypto.randomUUID();
  const meetingId = crypto.randomUUID();

  const launchDate = new Date();
  launchDate.setUTCHours(0, 0, 0, 0);
  const launchIso = launchDate.toISOString().slice(0, 10);
  const due = new Date(launchDate);
  due.setUTCDate(due.getUTCDate() + 7);
  const dueIso = due.toISOString().slice(0, 10);

  const insightContent = plainDoc(
    "Activation drops after onboarding step 3 — users abandon before connecting a data source.",
  );
  const problemContent = plainDoc(
    "Trial-to-paid conversion is flat despite traffic growth in the last two quarters.",
  );

  const experimentParagraphs = [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "If we simplify onboarding step 3, then activation will increase, because friction drops.",
        },
      ],
    },
  ];
  if (librarySource?.id) {
    experimentParagraphs.push(
      citationBlock(librarySource.id, librarySource.file_name || "Library source"),
    );
    experimentParagraphs.push({
      type: "paragraph",
      content: [{ type: "text", text: "Evidence linked above from the library." }],
    });
  }

  const rows = [
    {
      id: insightId,
      workspace_id: workspaceId,
      created_by: userId,
      title: "Fixture Insight: onboarding drop-off",
      content: insightContent,
      content_plain: "Activation drops after onboarding step 3.",
      metadata: {
        seed_source: SEED_MARKER,
        document_type: "insight",
        template_slug: "insight",
        status: "draft",
        state: "raw",
        summary: "Users abandon onboarding at step 3.",
        product_area: "Activation",
      },
    },
    {
      id: problemId,
      workspace_id: workspaceId,
      created_by: userId,
      title: "Fixture Problem: trial conversion flat",
      content: problemContent,
      content_plain: "Trial-to-paid conversion is flat.",
      metadata: {
        seed_source: SEED_MARKER,
        document_type: "problem",
        template_slug: "problem",
        status: "draft",
        state: "validating",
        summary: "Conversion plateau despite traffic.",
        product_area: "Growth",
      },
    },
    {
      id: experimentId,
      workspace_id: workspaceId,
      created_by: userId,
      title: "Fixture A/B: simplify onboarding step 3",
      content: { type: "doc", content: experimentParagraphs },
      content_plain: "If we simplify onboarding step 3, then activation will increase.",
      metadata: {
        seed_source: SEED_MARKER,
        document_type: "ab_experiment",
        template_slug: "ab-experiment",
        summary: "Test simpler step 3 to lift activation.",
        ab_experiment_status: "design",
        launch_date: launchIso,
        planned_duration_days: 14,
        traffic_split: "50/50",
        funnel_stage: "activation",
        origin: {
          document_id: insightId,
          title: "Fixture Insight: onboarding drop-off",
        },
        primary_kpi: [
          {
            label: "Activation rate",
            baseline: "22%",
            lift_pct: 15,
          },
        ],
      },
    },
    {
      id: ticketId,
      workspace_id: workspaceId,
      created_by: userId,
      title: "Fixture Ticket: wire Gantt duration",
      content: plainDoc("Track Gantt end = launch + planned_duration_days."),
      content_plain: "Track Gantt end = launch + planned_duration_days.",
      metadata: {
        seed_source: SEED_MARKER,
        document_type: "ticket",
        template_slug: "ticket",
        status: "in_progress",
        due_date: dueIso,
        ticket_priority: "high",
        ticket_type: ["chore"],
        summary: "Verify Gantt duration derivation.",
      },
    },
    {
      id: meetingId,
      workspace_id: workspaceId,
      created_by: userId,
      title: "Fixture Meeting: growth sync",
      content: plainDoc("Agenda: review onboarding experiment design."),
      content_plain: "Agenda: review onboarding experiment design.",
      metadata: {
        seed_source: SEED_MARKER,
        document_type: "meeting_notes",
        template_slug: "meeting-notes",
        status: "draft",
        meeting_date: launchIso,
        meeting_type: "planning",
        due_date: dueIso,
        summary: "Growth sync about the fixture experiment.",
        origin: {
          document_id: experimentId,
          title: "Fixture A/B: simplify onboarding step 3",
        },
      },
    },
  ];

  const { error } = await supabase.from("documents").insert(rows);
  if (error) throw error;

  console.log(`Inserted ${rows.length} view fixture documents`);
  if (librarySource?.id) {
    console.log(`Experiment cites library source ${librarySource.id}`);
  } else {
    console.log("No library source in scope — citation edge deferred to Phase 3 upload");
  }
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

async function ensureViewsEnabled(supabase, workspaceId) {
  const needed = ["dashboard", "gantt", "graph", "kanban", "wiki", "mindmap"];
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("enabled_views")
    .eq("id", workspaceId)
    .single();
  if (error) throw error;
  const current = workspace.enabled_views ?? [];
  const next = [...new Set([...current, ...needed])];
  if (next.length === current.length) return;
  const { error: updateError } = await supabase
    .from("workspaces")
    .update({ enabled_views: next })
    .eq("id", workspaceId);
  if (updateError) throw updateError;
  console.log(`Enabled views: ${needed.join(", ")}`);
}

async function ensureSchemaFields(supabase, workspaceId) {
  const fields = [
    {
      field_key: "ab_experiment_status",
      field_label: "Experiment status",
      field_type: "status",
      options: [
        { value: "backlog", label: "Backlog", category: "unstarted" },
        { value: "design", label: "Design", category: "unstarted" },
        { value: "engineering", label: "Engineering", category: "started" },
        { value: "live", label: "Live", category: "started" },
        { value: "analyzing", label: "Analyzing", category: "started" },
        { value: "concluded", label: "Concluded", category: "completed" },
      ],
    },
    {
      field_key: "launch_date",
      field_label: "Launch date",
      field_type: "date",
      options: null,
    },
    {
      field_key: "planned_duration_days",
      field_label: "Planned duration",
      field_type: "number",
      options: { unit: "days" },
    },
    {
      field_key: "due_date",
      field_label: "Due",
      field_type: "date",
      options: null,
    },
    {
      field_key: "status",
      field_label: "Status",
      field_type: "select",
      options: ["draft", "in_progress", "done"],
    },
    {
      field_key: "origin",
      field_label: "Origin",
      field_type: "relation",
      options: null,
    },
  ];

  for (const field of fields) {
    const { data: existing } = await supabase
      .from("metadata_schemas")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("field_key", field.field_key)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("metadata_schemas").insert({
      workspace_id: workspaceId,
      field_key: field.field_key,
      field_label: field.field_label,
      field_type: field.field_type,
      options: field.options,
      ai_fill_enabled: false,
    });
    if (error) throw error;
    console.log(`Created schema field ${field.field_key}`);
  }

  await ensureGanttInstance(supabase, workspaceId);
  await ensureDashboardInstance(supabase, workspaceId);
}

async function ensureGanttInstance(supabase, workspaceId) {
  const { data: existing } = await supabase
    .from("scope_view_instances")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("base_view_type", "gantt")
    .limit(1)
    .maybeSingle();
  if (existing) return;
  const { error } = await supabase.from("scope_view_instances").insert({
    workspace_id: workspaceId,
    base_view_type: "gantt",
    label: "Timeline",
    config: {
      startField: "launch_date",
      durationField: "planned_duration_days",
    },
    position: 0,
  });
  if (error) throw error;
  console.log("Created Gantt view instance");
}

async function ensureDashboardInstance(supabase, workspaceId) {
  const { data: existing } = await supabase
    .from("scope_view_instances")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("base_view_type", "dashboard")
    .limit(1)
    .maybeSingle();
  if (existing) return;
  const { error } = await supabase.from("scope_view_instances").insert({
    workspace_id: workspaceId,
    base_view_type: "dashboard",
    label: "Dashboard",
    config: {
      widgets: [
        {
          id: "w-breakdown-status",
          type: "breakdown",
          title: "Experiments by status",
          field: "ab_experiment_status",
          aggregation: "count",
          groupByField: "ab_experiment_status",
        },
        {
          id: "w-list-recent",
          type: "list",
          title: "Recent documents",
          field: "status",
          aggregation: "count",
        },
      ],
    },
    position: 0,
  });
  if (error) {
    // Config shape may vary — still create a bare instance
    const { error: bare } = await supabase.from("scope_view_instances").insert({
      workspace_id: workspaceId,
      base_view_type: "dashboard",
      label: "Dashboard",
      config: {},
      position: 0,
    });
    if (bare) throw bare;
  }
  console.log("Created Dashboard view instance");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
