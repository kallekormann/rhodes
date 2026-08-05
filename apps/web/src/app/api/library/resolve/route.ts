/**
 * Resolve library source / chunk ids to library_sources.id for citation edges.
 * POST body: { workspace_id, ids: string[] }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { resolveLibrarySourceById } from "@/lib/library/resolve-source";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  ids: z.array(z.string().uuid()).max(200),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
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

  const map: Record<string, string> = {};
  const unique = [...new Set(parsed.data.ids)];
  for (const id of unique) {
    try {
      const source = await resolveLibrarySourceById(supabase, id);
      if (source && source.workspace_id === parsed.data.workspace_id) {
        map[id] = source.id;
      }
    } catch {
      // skip unresolvable ids
    }
  }

  return withSecurityHeaders(NextResponse.json({ map }));
}
