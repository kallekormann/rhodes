import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { imageServeUrl } from "@/lib/documents/document-image-urls";
import { canReadDocumentImage } from "@/lib/documents/image-access";
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

  const allowed = await Promise.all(
    paths.map(async (path) => ({
      path,
      ok: await canReadDocumentImage(supabase, path, user.id),
    })),
  );
  for (const entry of allowed) {
    if (!entry.ok) continue;
    urls[entry.path] = imageServeUrl(entry.path);
  }

  return withSecurityHeaders(NextResponse.json({ urls }));
}
