import { z } from "zod";
import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { canReadWorkspaceMetadata } from "@/lib/metadata/access";
import { computeAllWidgetResults, type DashboardDocument } from "@/lib/views/dashboard";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };

const metadataFilterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(["eq", "neq", "in", "exists"]),
  value: z.unknown().optional(),
});

const dashboardWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["stat", "breakdown", "trend", "list"]),
  title: z.string().min(1).max(200),
  field: z.string().min(1),
  aggregation: z.enum(["count", "sum", "avg", "min", "max"]).optional(),
  groupByField: z.string().min(1).optional(),
  filter: metadataFilterSchema.optional(),
});

const dashboardQuerySchema = z.object({
  widgets: z.array(dashboardWidgetSchema).max(20),
});

export async function POST(request: Request, context: RouteContext) {
  const { workspaceId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = dashboardQuerySchema.safeParse(body);

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

  const canRead = await canReadWorkspaceMetadata(supabase, workspaceId);
  if (!canRead) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const { data: schemaRows, error: schemaError } = await supabase
    .from("metadata_schemas")
    .select("field_key")
    .eq("workspace_id", workspaceId);

  if (schemaError) {
    return withSecurityHeaders(
      NextResponse.json({ error: schemaError.message }, { status: 500 }),
    );
  }

  // Allowlist: only fields that exist in this workspace's schema may be aggregated —
  // never interpolate raw client field names into a query.
  const allowedFields = new Set((schemaRows ?? []).map((row) => row.field_key as string));

  for (const widget of parsed.data.widgets) {
    if (!allowedFields.has(widget.field)) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: `Unknown metadata field: ${widget.field}` },
          { status: 400 },
        ),
      );
    }
    if (widget.groupByField && !allowedFields.has(widget.groupByField)) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: `Unknown metadata field: ${widget.groupByField}` },
          { status: 400 },
        ),
      );
    }
    if (widget.filter && !allowedFields.has(widget.filter.field)) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: `Unknown metadata field: ${widget.filter.field}` },
          { status: 400 },
        ),
      );
    }
  }

  const { data: documentRows, error: documentsError } = await supabase
    .from("documents")
    .select("id, title, metadata")
    .eq("workspace_id", workspaceId)
    .or("metadata->archived.is.null,metadata->archived.eq.false")
    .or("metadata->template_draft.is.null,metadata->template_draft.eq.false");

  if (documentsError) {
    return withSecurityHeaders(
      NextResponse.json({ error: documentsError.message }, { status: 500 }),
    );
  }

  const documents: DashboardDocument[] = (documentRows ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string) ?? "",
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  }));

  const results = computeAllWidgetResults(parsed.data.widgets, documents);

  return withSecurityHeaders(NextResponse.json({ results }));
}
