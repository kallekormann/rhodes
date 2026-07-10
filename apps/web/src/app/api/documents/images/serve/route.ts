import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  contentTypeForPath,
  readLocalDocumentImage,
} from "@/lib/documents/local-image-storage";
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

  const localBytes = await readLocalDocumentImage(path);
  if (localBytes) {
    return withSecurityHeaders(
      new NextResponse(Buffer.from(localBytes), {
        headers: {
          "Content-Type": contentTypeForPath(path),
          "Cache-Control": "private, max-age=3600",
        },
      }),
    );
  }

  const { data: signed, error } = await supabase.storage
    .from("document-images")
    .createSignedUrl(path, 60 * 60);

  if (error || !signed?.signedUrl) {
    return withSecurityHeaders(
      NextResponse.json({ error: error?.message ?? "Sign failed" }, { status: 400 }),
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
