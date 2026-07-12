import { NextResponse } from "next/server";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  contentDispositionForLibraryFile,
  contentTypeForLibraryFile,
} from "@/lib/library/file-types";
import { readLocalLibraryFile } from "@/lib/library/local-storage";
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

  const localBytes = await readLocalLibraryFile(source.file_path);
  if (localBytes) {
    return withSecurityHeaders(
      new NextResponse(Buffer.from(localBytes), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": contentDisposition,
          "Cache-Control": "private, max-age=3600",
        },
      }),
    );
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(LIBRARY_BUCKET)
    .download(source.file_path);

  if (downloadError || !blob) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: downloadError?.message ?? "File unavailable" },
        { status: 404 },
      ),
    );
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const response = new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "private, max-age=3600",
    },
  });

  return withSecurityHeaders(response);
}
