import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { resolveSharedByDisplayName } from "@/lib/documents/enrich-share-context";
import { recordDocumentActivity } from "@/lib/documents/activity";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

type ShareRow = {
  id: string;
  grantee_type: "user" | "workspace";
  grantee_user_id: string | null;
  grantee_workspace_id: string | null;
  label: string;
  shared_by: string | null;
  permission: "read" | "edit";
  created_at: string;
};

const sharePermissionSchema = z.enum(["read", "edit"]);

const createShareSchema = z.object({
  grantee_type: z.enum(["user", "workspace"]),
  grantee_id: z.string().min(1),
  label: z.string().trim().min(1),
  permission: sharePermissionSchema.optional().default("edit"),
});

const updateSharePermissionSchema = z.object({
  share_id: z.string().uuid(),
  permission: sharePermissionSchema,
});

function pickIncomingShare(
  shares: ShareRow[],
  userId: string,
  activeWorkspaceId: string | null,
  includePersonalUserShares: boolean,
): ShareRow | null {
  if (activeWorkspaceId) {
    const workspaceShare = shares.find(
      (share) =>
        share.grantee_type === "workspace" &&
        share.grantee_workspace_id === activeWorkspaceId,
    );
    if (workspaceShare) return workspaceShare;
  }

  if (includePersonalUserShares) {
    const userShare = shares.find(
      (share) => share.grantee_type === "user" && share.grantee_user_id === userId,
    );
    if (userShare) return userShare;
  }

  return null;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const activeWorkspaceId = searchParams.get("active_workspace_id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data, error } = await supabase
    .from("document_shares")
    .select(
      "id, grantee_type, grantee_user_id, grantee_workspace_id, label, shared_by, permission, created_at",
    )
    .eq("document_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  const shares = (data ?? []) as ShareRow[];

  let includePersonalUserShares = false;
  if (activeWorkspaceId) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("is_team_workspace")
      .eq("id", activeWorkspaceId)
      .maybeSingle();
    includePersonalUserShares = workspace?.is_team_workspace === false;
  }

  const incomingShare = pickIncomingShare(
    shares,
    user.id,
    activeWorkspaceId,
    includePersonalUserShares,
  );

  const sharedByUser = await resolveSharedByDisplayName(
    supabase,
    incomingShare?.shared_by,
  );

  let canWrite: boolean | undefined;
  if (activeWorkspaceId) {
    const { data: canWriteData, error: canWriteError } = await supabase.rpc(
      "can_write_document",
      { doc_id: id },
    );
    if (!canWriteError && typeof canWriteData === "boolean") {
      canWrite = canWriteData;
    }
  }

  return withSecurityHeaders(
    NextResponse.json({
      shares,
      shared_by_user: sharedByUser,
      incoming_permission: incomingShare?.permission ?? null,
      can_write: canWrite,
    }),
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = createShareSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid share payload" }, { status: 400 }),
    );
  }

  const { grantee_type: granteeType, grantee_id: granteeId, label, permission } =
    parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const insert = {
    document_id: id,
    shared_by: user.id,
    grantee_type: granteeType,
    label,
    permission,
    grantee_user_id: granteeType === "user" ? granteeId : null,
    grantee_workspace_id: granteeType === "workspace" ? granteeId : null,
  };

  const { data, error } = await supabase
    .from("document_shares")
    .insert(insert)
    .select(
      "id, grantee_type, grantee_user_id, grantee_workspace_id, label, permission, created_at",
    )
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Share failed" }, { status: 400 }),
    );
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (doc?.workspace_id) {
    await recordDocumentActivity(supabase, {
      documentId: id,
      workspaceId: doc.workspace_id,
      actorId: user.id,
      actorDisplayName:
        profile?.display_name?.trim() || user.email?.split("@")[0] || "Someone",
      eventType: "shared_with",
      payload: { target: label, grantee_type: granteeType },
    });
  }

  return withSecurityHeaders(NextResponse.json({ share: data }, { status: 201 }));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateSharePermissionSchema.safeParse(body);

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid share update payload" }, { status: 400 }),
    );
  }

  const { share_id: shareId, permission } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data, error } = await supabase
    .from("document_shares")
    .update({ permission })
    .eq("id", shareId)
    .eq("document_id", id)
    .select(
      "id, grantee_type, grantee_user_id, grantee_workspace_id, label, permission, created_at",
    )
    .maybeSingle();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: error?.message ?? "Share update failed" },
        { status: 400 },
      ),
    );
  }

  return withSecurityHeaders(NextResponse.json({ share: data }));
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const shareId = searchParams.get("share_id");

  if (!shareId) {
    return withSecurityHeaders(
      NextResponse.json({ error: "share_id required" }, { status: 400 }),
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

  const { data: shareRow } = await supabase
    .from("document_shares")
    .select("label")
    .eq("id", shareId)
    .eq("document_id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("document_shares")
    .delete()
    .eq("id", shareId)
    .eq("document_id", id);

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (doc?.workspace_id) {
    await recordDocumentActivity(supabase, {
      documentId: id,
      workspaceId: doc.workspace_id,
      actorId: user.id,
      actorDisplayName:
        profile?.display_name?.trim() || user.email?.split("@")[0] || "Someone",
      eventType: "share_removed",
      payload: { target: shareRow?.label ?? "recipient" },
    });
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
