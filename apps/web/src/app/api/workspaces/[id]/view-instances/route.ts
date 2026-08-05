import { z } from "zod";
import { NextResponse } from "next/server";
import { VIEW_ENGINE_BASE_TYPES } from "@rhodes/shared/view-engine";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";
import { viewInstanceLayoutSchema } from "@/lib/views/view-instance-layout-schema";

type RouteContext = { params: Promise<{ id: string }> };

const INSTANCE_FIELDS =
  "id, workspace_id, base_view_type, label, config, layout, created_from_preset_id, position, created_at, updated_at";

const createInstanceSchema = z.object({
  base_view_type: z.enum(VIEW_ENGINE_BASE_TYPES),
  label: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  layout: viewInstanceLayoutSchema.optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  const { id: workspaceId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data: isMember } = await supabase.rpc("is_workspace_member", {
    ws_id: workspaceId,
  });
  if (!isMember) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const { data, error } = await supabase
    .from("scope_view_instances")
    .select(INSTANCE_FIELDS)
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 500 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ instances: data ?? [] }),
  );
}

const BASE_VIEW_TYPE_DEFAULT_LABEL: Record<string, string> = {
  kanban: "Kanban",
  calendar: "Calendar",
  gantt: "Roadmap",
  dashboard: "Dashboard",
  mindmap: "Mind-Map",
  graph: "Knowledge Graph",
  wiki: "Wiki",
};

export async function POST(request: Request, context: RouteContext) {
  const { id: workspaceId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = createInstanceSchema.safeParse(body);

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

  const { data: canWrite } = await supabase.rpc("can_write_workspace", {
    ws_id: workspaceId,
  });
  if (!canWrite) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "You have read-only access in this scope" },
        { status: 403 },
      ),
    );
  }

  const { data: existingRows } = await supabase
    .from("scope_view_instances")
    .select("position")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existingRows?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("scope_view_instances")
    .insert({
      workspace_id: workspaceId,
      base_view_type: parsed.data.base_view_type,
      label:
        parsed.data.label ??
        BASE_VIEW_TYPE_DEFAULT_LABEL[parsed.data.base_view_type] ??
        parsed.data.base_view_type,
      config: parsed.data.config ?? {},
      ...(parsed.data.layout !== undefined ? { layout: parsed.data.layout } : {}),
      position: nextPosition,
    })
    .select(INSTANCE_FIELDS)
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ instance: data }, { status: 201 }));
}
