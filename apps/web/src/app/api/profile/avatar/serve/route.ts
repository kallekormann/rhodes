import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { AVATAR_BUCKET } from "@/lib/profile/avatar";
import {
  contentTypeForAvatarPath,
  readLocalAvatar,
} from "@/lib/profile/local-avatar-storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storagePath = searchParams.get("path");

  if (!storagePath) {
    return withSecurityHeaders(
      NextResponse.json({ error: "path required" }, { status: 400 }),
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

  const localBytes = await readLocalAvatar(storagePath);
  if (localBytes) {
    return withSecurityHeaders(
      new NextResponse(Buffer.from(localBytes), {
        headers: {
          "Content-Type": contentTypeForAvatarPath(storagePath),
          "Cache-Control": "private, max-age=3600",
        },
      }),
    );
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (base) {
    const publicUrl = `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${storagePath}`;
    return NextResponse.redirect(publicUrl);
  }

  return withSecurityHeaders(
    NextResponse.json({ error: "Avatar not found" }, { status: 404 }),
  );
}
