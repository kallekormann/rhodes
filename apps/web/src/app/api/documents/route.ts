import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { extractPlainText } from "@/lib/documents/plain-text";
import {
  createDocumentSchema,
  EMPTY_DOCUMENT_CONTENT,
  listDocumentsQuerySchema,
} from "@/lib/documents/schemas";
import { createClient } from "@/lib/supabase/server";
import { stripLeadingTitleHeading } from "@/lib/templates/content";

const DOCUMENT_FIELDS =
  "id, workspace_id, created_by, title, content, content_plain, metadata, updated_at, created_at";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listDocumentsQuerySchema.safeParse({
    workspace_id: searchParams.get("workspace_id"),
    filter: searchParams.get("filter") ?? "recent",
  });

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  if (parsed.data.filter === "shared") {
    const { data: memberships } = await supabase
      .from("workspace_members")
      .select("workspace_id");

    const workspaceIds = (memberships ?? []).map((row) => row.workspace_id);

    const { data: incomingShares } = await supabase
      .from("document_shares")
      .select("document_id")
      .or(
        [
          `grantee_user_id.eq.${user.id}`,
          workspaceIds.length > 0
            ? `grantee_workspace_id.in.(${workspaceIds.join(",")})`
            : null,
        ]
          .filter(Boolean)
          .join(","),
      );

    const { data: workspaceDocs } = await supabase
      .from("documents")
      .select("id")
      .eq("workspace_id", parsed.data.workspace_id);

    const workspaceDocIds = (workspaceDocs ?? []).map((row) => row.id);

    const { data: outgoingShares } =
      workspaceDocIds.length > 0
        ? await supabase
            .from("document_shares")
            .select("document_id")
            .in("document_id", workspaceDocIds)
        : { data: [] };

    const documentIds = new Set<string>();
    for (const row of incomingShares ?? []) {
      if (row.document_id) documentIds.add(row.document_id);
    }
    for (const row of outgoingShares ?? []) {
      if (row.document_id) documentIds.add(row.document_id);
    }

    if (documentIds.size === 0) {
      return withSecurityHeaders(NextResponse.json({ documents: [] }));
    }

    const { data, error } = await supabase
      .from("documents")
      .select(DOCUMENT_FIELDS)
      .in("id", [...documentIds])
      .or("metadata->template_draft.is.null,metadata->template_draft.eq.false")
      .order("updated_at", { ascending: false });

    if (error) {
      return withSecurityHeaders(
        NextResponse.json({ error: error.message }, { status: 400 }),
      );
    }

    return withSecurityHeaders(NextResponse.json({ documents: data ?? [] }));
  }

  let query = supabase
    .from("documents")
    .select(DOCUMENT_FIELDS)
    .eq("workspace_id", parsed.data.workspace_id)
    .order("updated_at", { ascending: false });

  if (parsed.data.filter === "archive") {
    query = query.contains("metadata", { archived: true });
  } else {
    query = query.or("metadata->archived.is.null,metadata->archived.eq.false");
  }

  query = query.or(
    "metadata->template_draft.is.null,metadata->template_draft.eq.false",
  );

  if (parsed.data.filter === "recent") {
    query = query.limit(50);
  }

  if (parsed.data.filter === "favorites") {
    query = query.contains("metadata", { favorite: true });
  }

  const { data, error } = await query;

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ documents: data ?? [] }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  let content: Record<string, unknown> = { ...EMPTY_DOCUMENT_CONTENT };
  let metadata: Record<string, unknown> = parsed.data.metadata ?? {};

  if (parsed.data.template_id) {
    const template = await supabase
      .from("templates")
      .select("structure_json, metadata")
      .eq("id", parsed.data.template_id)
      .maybeSingle();

    if (template.data?.structure_json) {
      content = template.data.structure_json as Record<string, unknown>;
    }

    const templateMetadata =
      (template.data?.metadata as Record<string, unknown> | null) ?? {};
    const defaultProperties =
      templateMetadata.default_properties &&
      typeof templateMetadata.default_properties === "object"
        ? (templateMetadata.default_properties as Record<string, unknown>)
        : {};

    metadata = {
      ...defaultProperties,
      ...metadata,
    };
  }

  const title = parsed.data.title ?? "Untitled Document";

  if (parsed.data.template_id) {
    content = stripLeadingTitleHeading(content, title);
  }

  const content_plain = extractPlainText(content).trim();

  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: parsed.data.workspace_id,
      created_by: user.id,
      title,
      content,
      content_plain,
      metadata,
    })
    .select(DOCUMENT_FIELDS)
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ document: data }, { status: 201 }));
}
