import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((path: unknown): path is string => typeof path === "string")
    : [];

  if (paths.length === 0) {
    return withSecurityHeaders(NextResponse.json({ urls: {} }));
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

  const urls: Record<string, string> = {};

  for (const path of paths) {
    const workspaceId = path.split("/")[0];
    if (!workspaceId) continue;

    const { data: allowed } = await supabase.rpc("is_workspace_member", {
      ws_id: workspaceId,
    });
    if (!allowed) continue;

    const { data: signed } = await supabase.storage
      .from("document-images")
      .createSignedUrl(path, 60 * 60 * 24);

    if (signed?.signedUrl) {
      urls[path] = signed.signedUrl;
      continue;
    }

    urls[path] = `/app/api/documents/images/serve?path=${encodeURIComponent(path)}`;
  }

  return withSecurityHeaders(NextResponse.json({ urls }));
}
