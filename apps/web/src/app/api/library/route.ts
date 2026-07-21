import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  LIBRARY_FILE_TYPE_PATTERNS,
  listLibraryQuerySchema,
  type LibraryFileTypeFilter,
} from "@/lib/library/schemas";
import { createClient } from "@/lib/supabase/server";

const SOURCE_FIELDS =
  "id, workspace_id, uploaded_by, file_name, file_path, file_type, summary, embedding_status, metadata, created_at";

function startOfDayIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function endOfDayIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("T")) {
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }
  const date = new Date(`${trimmed}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function applyFileTypeFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  fileType: LibraryFileTypeFilter,
) {
  if (fileType === "all") return query;
  const patterns = LIBRARY_FILE_TYPE_PATTERNS[fileType];
  if (!patterns?.length) return query;
  const orClause = patterns.map((pattern) => `file_type.ilike.${pattern}`).join(",");
  return query.or(orClause);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listLibraryQuerySchema.safeParse({
    workspace_id: searchParams.get("workspace_id"),
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    file_type: searchParams.get("file_type") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
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

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: parsed.data.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const { limit, offset, q, file_type: fileType } = parsed.data;
  const fromIso = parsed.data.from ? startOfDayIso(parsed.data.from) : null;
  const toIso = parsed.data.to ? endOfDayIso(parsed.data.to) : null;

  let query = supabase
    .from("library_sources")
    .select(SOURCE_FIELDS, { count: "exact" })
    .eq("workspace_id", parsed.data.workspace_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.ilike("file_name", `%${q}%`);
  }

  query = applyFileTypeFilter(query, fileType);

  if (fromIso) {
    query = query.gte("created_at", fromIso);
  }
  if (toIso) {
    query = query.lte("created_at", toIso);
  }

  const { data, error, count } = await query;

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      sources: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    }),
  );
}
