import { NextResponse } from "next/server";
import { z } from "zod";
import { retrieveWorkspaceKnowledge } from "@rhodes/ai";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

const insightsSchema = z.object({
  workspace_id: z.string().uuid(),
  query_text: z.string().min(1).max(8000),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = insightsSchema.safeParse(body);

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

  try {
    const matches = await retrieveWorkspaceKnowledge({
      workspaceId: parsed.data.workspace_id,
      queryText: parsed.data.query_text,
      matchCount: 8,
    });

    const insights = matches.slice(0, 4).map((match) => ({
      ...match,
      source_ref_id: match.source_ref_id ?? match.item_id,
      relevance_percent: Math.round(match.similarity * 100),
    }));

    return withSecurityHeaders(NextResponse.json({ insights }));
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Insight retrieval failed",
        },
        { status: 503 },
      ),
    );
  }
}
