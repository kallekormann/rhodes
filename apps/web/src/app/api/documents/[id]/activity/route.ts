import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

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
    .from("document_activity")
    .select(
      "id, document_id, workspace_id, actor_id, event_type, summary, payload, created_at",
    )
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  const rows = data ?? [];
  const actorIds = [
    ...new Set(
      rows
        .map((row) => row.actor_id)
        .filter((actorId): actorId is string => typeof actorId === "string"),
    ),
  ];

  let profileById = new Map<string, { display_name: string; avatar_url: string | null }>();
  if (actorIds.length > 0) {
    const { data: names } = await supabase.rpc(
      "user_display_names_for_document_shares",
      { user_ids: actorIds },
    );
    if (Array.isArray(names)) {
      profileById = new Map(
        names.map(
          (row: {
            id: string;
            display_name: string;
            avatar_url?: string | null;
          }) => [
            row.id,
            {
              display_name: row.display_name,
              avatar_url: row.avatar_url ?? null,
            },
          ],
        ),
      );
    }

    const missingActorIds = actorIds.filter((actorId) => !profileById.has(actorId));
    if (missingActorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", missingActorIds);

      for (const profile of profiles ?? []) {
        profileById.set(profile.id, {
          display_name:
            profile.display_name?.trim() ||
            profile.id.slice(0, 8),
          avatar_url: profile.avatar_url ?? null,
        });
      }
    }
  }

  const activity = rows.map((row) => {
    const actorProfile = row.actor_id ? profileById.get(row.actor_id) : undefined;
    return {
      ...row,
      actor_display_name: actorProfile?.display_name ?? null,
      actor_avatar_url: actorProfile?.avatar_url ?? null,
    };
  });

  return withSecurityHeaders(NextResponse.json({ activity }));
}
