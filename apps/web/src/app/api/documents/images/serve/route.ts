import { NextResponse } from "next/server";
import { createAdminObjectStorage } from "@rhodes/db/object-storage";
import { DOCUMENT_IMAGES_BUCKET } from "@rhodes/shared/constants";
import { allowLocalStorageFallback } from "@rhodes/shared/storage-env";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import { canReadDocumentImage } from "@/lib/documents/image-access";
import {
  contentTypeForPath,
  readLocalDocumentImage,
} from "@/lib/documents/local-image-storage";
import { createClient } from "@/lib/supabase/server";
import { toBrowserSupabaseUrl } from "@/lib/supabase/urls";

const SIGNED_URL_TTL_SECONDS = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
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

  const allowed = await canReadDocumentImage(supabase, path, user.id);

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const storage = createAdminObjectStorage();
  const signedUrl = await storage.signedUrl(
    DOCUMENT_IMAGES_BUCKET,
    path,
    SIGNED_URL_TTL_SECONDS,
  );

  if (signedUrl) {
    const browserUrl = toBrowserSupabaseUrl(signedUrl);
    const response = NextResponse.redirect(browserUrl, 307);
    response.headers.set("Cache-Control", "private, max-age=300");
    return withSecurityHeaders(response);
  }

  if (allowLocalStorageFallback()) {
    const bytes = await readLocalDocumentImage(path);
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
  }

  return withSecurityHeaders(
    NextResponse.json({ error: "Image unavailable" }, { status: 404 }),
  );
}
