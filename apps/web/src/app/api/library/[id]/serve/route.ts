import { NextResponse } from "next/server";
import { createSessionObjectStorage } from "@rhodes/db/object-storage";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  contentDispositionForLibraryFile,
  contentTypeForLibraryFile,
} from "@/lib/library/file-types";
import { resolveLibrarySourceById } from "@/lib/library/resolve-source";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  let source;
  try {
    source = await resolveLibrarySourceById(supabase, id);
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Lookup failed" },
        { status: 500 },
      ),
    );
  }

  if (!source) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: source.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const contentType = contentTypeForLibraryFile(source.file_name, source.file_type);
  const contentDisposition = contentDispositionForLibraryFile(
    source.file_name,
    source.file_type,
  );

  const storage = createSessionObjectStorage(supabase);
  const bytes = await storage.get(LIBRARY_BUCKET, source.file_path);

  if (!bytes || bytes.length === 0) {
    return withSecurityHeaders(
      NextResponse.json({ error: "File unavailable" }, { status: 404 }),
    );
  }

  return withSecurityHeaders(
    new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, max-age=3600",
      },
    }),
  );
}
