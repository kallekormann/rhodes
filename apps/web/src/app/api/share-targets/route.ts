import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

type ShareTargetRow = {
  kind: string;
  target_id: string;
  label: string;
  subtitle: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const { data, error } = await supabase.rpc("search_document_share_targets", {
    p_query: query,
  });

  if (error) {
    return withSecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 400 }),
    );
  }

  const targets = ((data ?? []) as ShareTargetRow[]).map((row) => ({
    kind: row.kind === "user" ? ("user" as const) : ("workspace" as const),
    id: row.target_id,
    label: row.label,
    subtitle: row.subtitle,
  }));

  return withSecurityHeaders(NextResponse.json({ targets }));
}
