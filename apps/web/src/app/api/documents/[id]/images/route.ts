import { NextResponse } from "next/server";
import { createAdminClient } from "@rhodes/db";
import { withSecurityHeaders } from "@/lib/api/security-headers";
import {
  saveLocalDocumentImage,
} from "@/lib/documents/local-image-storage";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
};

function resolveImageContentType(file: File): string | null {
  if (file.type.startsWith("image/")) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_MIME[ext] ?? null;
}

export async function POST(request: Request, context: RouteContext) {
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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return withSecurityHeaders(
      NextResponse.json({ error: "file required" }, { status: 400 }),
    );
  }

  const contentType = resolveImageContentType(file);
  if (!contentType) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Only images are supported" },
        { status: 400 },
      ),
    );
  }

  if (file.size > MAX_BYTES) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 }),
    );
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();

  if (docError || !document) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Document not found" }, { status: 404 }),
    );
  }

  const { data: allowed } = await supabase.rpc("is_workspace_member", {
    ws_id: document.workspace_id,
  });

  if (!allowed) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${document.workspace_id}/${id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("document-images")
    .upload(path, bytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    if (process.env.NODE_ENV !== "production") {
      try {
        await saveLocalDocumentImage(path, bytes);
        return withSecurityHeaders(
          NextResponse.json({ path, storage: "local" }, { status: 201 }),
        );
      } catch (localError) {
        const message =
          localError instanceof Error ? localError.message : "Local save failed";
        return withSecurityHeaders(
          NextResponse.json({ error: message }, { status: 400 }),
        );
      }
    }

    return withSecurityHeaders(
      NextResponse.json({ error: uploadError.message }, { status: 400 }),
    );
  }

  return withSecurityHeaders(
    NextResponse.json({ path, storage: "supabase" }, { status: 201 }),
  );
}
