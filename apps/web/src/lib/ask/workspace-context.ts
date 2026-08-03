import type { createClient } from "@/lib/supabase/server";
import { parseSchemaOptions } from "@/lib/metadata/schemas";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const DOC_LIMIT = 40;
const LIBRARY_LIMIT = 40;
const TEMPLATE_LIMIT = 30;
const MAX_OVERVIEW_CHARS = 6000;

const SYSTEM_META_KEYS = new Set([
  "favorite",
  "archived",
  "archived_at",
  "comments",
  "template_draft",
  "template_description",
  "_ai_filled_keys",
]);

export type WorkspaceAskContext = {
  overviewText: string;
  /** True when there is at least some structured inventory to answer meta questions. */
  hasContent: boolean;
};

function formatPropValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return null;
}

function truncateOverview(text: string): string {
  if (text.length <= MAX_OVERVIEW_CHARS) return text;
  return `${text.slice(0, MAX_OVERVIEW_CHARS - 20).trimEnd()}\n… (truncated)`;
}

/**
 * Live, member-scoped workspace brief for Ask (not stored).
 * Used for inventory / “about this scope” questions alongside RAG chunks.
 */
export async function buildWorkspaceAskContext(
  supabase: SupabaseServer,
  workspaceId: string,
): Promise<WorkspaceAskContext> {
  const [
    workspaceResult,
    documentsResult,
    libraryResult,
    templatesResult,
    schemasResult,
    groupsResult,
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, is_team_workspace")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, title, metadata, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(DOC_LIMIT),
    supabase
      .from("library_sources")
      .select("id, file_name, embedding_status, summary, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(LIBRARY_LIMIT),
    supabase
      .from("templates")
      .select("id, name, description, is_system")
      .or(`is_system.eq.true,workspace_id.eq.${workspaceId}`)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true })
      .limit(TEMPLATE_LIMIT),
    supabase
      .from("metadata_schemas")
      .select("field_key, field_label, field_type, options, group_id")
      .eq("workspace_id", workspaceId)
      .is("group_id", null)
      .order("field_label", { ascending: true }),
    supabase
      .from("metadata_schema_groups")
      .select("group_key, group_label")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true }),
  ]);

  const workspace = workspaceResult.data;
  const documents = documentsResult.data ?? [];
  const library = libraryResult.data ?? [];
  const templates = templatesResult.data ?? [];
  const schemas = schemasResult.data ?? [];
  const groups = groupsResult.data ?? [];

  const selectKeys = schemas
    .filter(
      (field) =>
        field.field_type === "select" ||
        field.field_type === "multi_select" ||
        field.field_type === "status",
    )
    .map((field) => field.field_key);

  // Prefer status first in property snippets
  const propKeys = [
    ...selectKeys.filter((key) => key === "status"),
    ...selectKeys.filter((key) => key !== "status"),
  ].slice(0, 4);

  const lines: string[] = [];

  if (workspace) {
    lines.push(
      `Scope: ${workspace.name} (${workspace.is_team_workspace ? "team" : "personal"})`,
    );
  } else {
    lines.push("Scope: (unknown)");
  }

  lines.push("");
  lines.push(`Documents (showing ${documents.length}${documents.length >= DOC_LIMIT ? "+" : ""}):`);
  if (documents.length === 0) {
    lines.push("- (none)");
  } else {
    for (const doc of documents) {
      const title = (doc.title ?? "").trim() || "Untitled";
      const meta =
        doc.metadata && typeof doc.metadata === "object" && !Array.isArray(doc.metadata)
          ? (doc.metadata as Record<string, unknown>)
          : {};
      const props: string[] = [];
      for (const key of propKeys) {
        if (SYSTEM_META_KEYS.has(key)) continue;
        const formatted = formatPropValue(meta[key]);
        if (formatted) props.push(`${key}=${formatted}`);
      }
      if (meta.archived === true) props.push("archived");
      if (meta.favorite === true) props.push("favorite");
      lines.push(
        props.length > 0 ? `- ${title} [${props.join("; ")}]` : `- ${title}`,
      );
    }
  }

  lines.push("");
  lines.push(`Library files (showing ${library.length}${library.length >= LIBRARY_LIMIT ? "+" : ""}):`);
  if (library.length === 0) {
    lines.push("- (none)");
  } else {
    for (const source of library) {
      const name = (source.file_name ?? "").trim() || "Untitled file";
      const status = source.embedding_status ? ` status=${source.embedding_status}` : "";
      const summary =
        typeof source.summary === "string" && source.summary.trim()
          ? ` — ${source.summary.trim().slice(0, 120)}`
          : "";
      lines.push(`- ${name}${status}${summary}`);
    }
  }

  lines.push("");
  lines.push(`Templates (showing ${templates.length}):`);
  if (templates.length === 0) {
    lines.push("- (none)");
  } else {
    for (const template of templates) {
      const name = (template.name ?? "").trim() || "Untitled template";
      const desc =
        typeof template.description === "string" && template.description.trim()
          ? ` — ${template.description.trim().slice(0, 80)}`
          : "";
      const sys = template.is_system ? " (system)" : "";
      lines.push(`- ${name}${sys}${desc}`);
    }
  }

  lines.push("");
  lines.push("Property fields:");
  if (schemas.length === 0) {
    lines.push("- (none)");
  } else {
    for (const field of schemas) {
      const options = parseSchemaOptions(field.options);
      const opt =
        options && options.length > 0
          ? ` options=[${options.slice(0, 8).join(", ")}${options.length > 8 ? ", …" : ""}]`
          : "";
      lines.push(`- ${field.field_label} (${field.field_key}, ${field.field_type})${opt}`);
    }
  }

  if (groups.length > 0) {
    lines.push("");
    lines.push("Property groups:");
    for (const group of groups) {
      lines.push(`- ${group.group_label} (${group.group_key})`);
    }
  }

  const overviewText = truncateOverview(lines.join("\n"));
  const hasContent =
    Boolean(workspace?.name) ||
    documents.length > 0 ||
    library.length > 0 ||
    templates.length > 0 ||
    schemas.length > 0;

  return { overviewText, hasContent };
}
