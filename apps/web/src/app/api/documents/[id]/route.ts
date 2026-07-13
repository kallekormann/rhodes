import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { extractPlainText } from "@/lib/documents/plain-text";
import {
  diffCommentChanges,
  diffMetadataPropertyChanges,
  recordDocumentActivity,
} from "@/lib/documents/activity";
import { buildContentEditExcerpt } from "@/lib/documents/activity-content";
import {
  shouldEnqueueDocumentEmbed,
  shouldEnqueueMetadataExtraction,
} from "@/lib/documents/embed-on-save";
import {
  enqueueDocumentEmbed,
  enqueueDocumentMetadataExtraction,
} from "@/lib/documents/queue";
import { updateDocumentSchema } from "@/lib/documents/schemas";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
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
    .from("documents")
    .select(
      "id, workspace_id, created_by, title, content, content_plain, metadata, updated_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  if (!data) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ document: data }));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateDocumentSchema.safeParse(body);

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

  const { data: existing, error: existingError } = await supabase
    .from("documents")
    .select("id, workspace_id, title, content, content_plain, metadata")
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: existingError?.message ?? "Not found" },
        { status: existingError ? 400 : 404 },
      ),
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
  if (parsed.data.content !== undefined) {
    patch.content = parsed.data.content;
    patch.content_plain =
      parsed.data.content_plain ?? extractPlainText(parsed.data.content).trim();
  } else if (parsed.data.content_plain !== undefined) {
    patch.content_plain = parsed.data.content_plain;
  }

  const { data, error } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select(
      "id, workspace_id, created_by, title, content, content_plain, metadata, updated_at, created_at",
    )
    .single();

  if (error || !data) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 400 }),
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const actorDisplayName =
    profile?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    "Someone";

  const { data: schemaRows } = await supabase
    .from("metadata_schemas")
    .select("field_key, field_label")
    .eq("workspace_id", data.workspace_id);

  const labelByKey = new Map(
    (schemaRows ?? []).map((row) => [row.field_key as string, row.field_label as string]),
  );

  const previousTitle = existing.title as string;
  const previousMetadata = existing.metadata as Record<string, unknown> | null;
  const nextMetadata = data.metadata as Record<string, unknown> | null;

  if (parsed.data.title !== undefined && parsed.data.title !== previousTitle) {
    await recordDocumentActivity(supabase, {
      documentId: data.id,
      workspaceId: data.workspace_id,
      actorId: user.id,
      actorDisplayName,
      eventType: "title_changed",
      payload: { title: data.title, previous_title: previousTitle },
    });
  }

  if (parsed.data.metadata !== undefined) {
    const commentDiff = diffCommentChanges(previousMetadata, nextMetadata);
    if (commentDiff.added > 0) {
      await recordDocumentActivity(supabase, {
        documentId: data.id,
        workspaceId: data.workspace_id,
        actorId: user.id,
        actorDisplayName,
        eventType: "comment_added",
        payload: {
          count: commentDiff.added,
          excerpt: commentDiff.addedExcerpt,
        },
      });
    }
    if (commentDiff.removed > 0) {
      await recordDocumentActivity(supabase, {
        documentId: data.id,
        workspaceId: data.workspace_id,
        actorId: user.id,
        actorDisplayName,
        eventType: "comment_removed",
        payload: { count: commentDiff.removed },
      });
    }

    for (const change of diffMetadataPropertyChanges(
      previousMetadata,
      nextMetadata,
      labelByKey,
    )) {
      await recordDocumentActivity(supabase, {
        documentId: data.id,
        workspaceId: data.workspace_id,
        actorId: user.id,
        actorDisplayName,
        eventType: "property_changed",
        payload: {
          field_key: change.fieldKey,
          field_label: change.fieldLabel,
          from: change.from,
          to: change.to,
        },
      });
    }
  }

  const previousPlain = existing.content_plain as string | null;
  const nextPlain =
    typeof patch.content_plain === "string"
      ? patch.content_plain
      : (data.content_plain as string | null);

  const contentChanged =
    parsed.data.content !== undefined || parsed.data.content_plain !== undefined
      ? previousPlain !== nextPlain
      : false;

  if (contentChanged && data.workspace_id) {
    const excerpt = buildContentEditExcerpt(previousPlain, nextPlain);
    await recordDocumentActivity(supabase, {
      documentId: data.id,
      workspaceId: data.workspace_id,
      actorId: user.id,
      actorDisplayName,
      eventType: "content_edited",
      payload: excerpt ? { excerpt } : {},
    });
  }

  if (
    shouldEnqueueDocumentEmbed(previousPlain, nextPlain) &&
    data.workspace_id
  ) {
    const { data: recentVersion } = await supabase
      .from("document_versions")
      .select("created_at")
      .eq("document_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const throttleElapsed = recentVersion?.created_at
      ? Date.now() - new Date(recentVersion.created_at).getTime()
      : Number.POSITIVE_INFINITY;

    if (throttleElapsed >= 5 * 60 * 1000) {
      await supabase.from("document_versions").insert({
        document_id: data.id,
        workspace_id: data.workspace_id,
        content: data.content,
        content_plain: data.content_plain,
        changed_by: user.id,
        change_summary: "Auto snapshot",
      });
    }

    try {
      await enqueueDocumentEmbed({
        documentId: data.id,
        workspaceId: data.workspace_id,
      });
    } catch (enqueueError) {
      console.error("document embed enqueue failed", enqueueError);
    }
  }

  if (
    shouldEnqueueMetadataExtraction(previousPlain, nextPlain) &&
    data.workspace_id
  ) {
    try {
      await enqueueDocumentMetadataExtraction({
        documentId: data.id,
        workspaceId: data.workspace_id,
      });
    } catch (enqueueError) {
      console.error("metadata extraction enqueue failed", enqueueError);
    }
  }

  return withSecurityHeaders(NextResponse.json({ document: data }));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}
