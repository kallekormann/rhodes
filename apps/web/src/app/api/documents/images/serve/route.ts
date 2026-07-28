import { NextResponse } from "next/server";
import { createSessionObjectStorage } from "@rhodes/db/object-storage";
import { DOCUMENT_IMAGES_BUCKET } from "@rhodes/shared/constants";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { contentTypeForPath } from "@/lib/documents/local-image-storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return withSecurityHeaders(
      NextResponse.json({ error: "path required" }, { status: 400 }),
    );
  }

  const workspaceId = path.split("/")[0];
  if (!workspaceId) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid path" }, { status: 400 }),
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
    ws_id: workspaceId,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const storage = createSessionObjectStorage(supabase);
  const signedUrl = await storage.signedUrl(
    DOCUMENT_IMAGES_BUCKET,
    path,
    60 * 60,
  );

  if (signedUrl) {
    return NextResponse.redirect(signedUrl);
  }

  const bytes = await storage.get(DOCUMENT_IMAGES_BUCKET, path);
  if (bytes && bytes.length > 0) {
    return withSecurityHeaders(
      new NextResponse(Buffer.from(bytes), {
        headers: {
          "Content-Type": contentTypeForPath(path),
          "Cache-Control": "private, max-age=3600",
        },
      }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ error: "Image unavailable" }, { status: 404 }),
  );
}
