import { DOCUMENT_IMAGES_BUCKET } from "@rhodes/shared/constants";
import { createClient } from "@/lib/supabase/client";
import { getBrowserSupabaseUrl } from "@/lib/supabase/urls";

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

export type DocumentImageUploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export class DocumentImageUploadError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DocumentImageUploadError";
    this.status = status;
  }
}

function resolveImageContentType(file: File): string | null {
  if (file.type.startsWith("image/")) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_MIME[ext] ?? null;
}

function buildDocumentImagePath(
  workspaceId: string,
  documentId: string,
  file: File,
): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  return `${workspaceId}/${documentId}/${crypto.randomUUID()}.${ext}`;
}

function encodeStorageObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parseStorageErrorMessage(responseText: string): string {
  try {
    const body = JSON.parse(responseText) as {
      message?: string;
      error?: string;
    };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    /* ignore */
  }
  return "Upload failed";
}

export async function uploadDocumentImage(input: {
  workspaceId: string;
  documentId: string;
  file: File;
  onProgress?: (progress: DocumentImageUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<{ path: string }> {
  const { workspaceId, documentId, file, onProgress, signal } = input;

  const contentType = resolveImageContentType(file);
  if (!contentType) {
    throw new DocumentImageUploadError("Only images are supported", 400);
  }

  if (file.size > MAX_BYTES) {
    throw new DocumentImageUploadError("Image must be under 5MB", 400);
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new DocumentImageUploadError("Unauthorized", 401);
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new DocumentImageUploadError("Missing Supabase configuration");
  }

  const path = buildDocumentImagePath(workspaceId, documentId, file);
  const baseUrl = getBrowserSupabaseUrl().replace(/\/$/, "");
  const url = `${baseUrl}/storage/v1/object/${DOCUMENT_IMAGES_BUCKET}/${encodeStorageObjectPath(path)}`;

  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file, file.name);

  onProgress?.({ loaded: 0, total: file.size, percent: 0 });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "false");

    const abort = () => {
      xhr.abort();
      reject(new DocumentImageUploadError("Upload cancelled"));
    };

    if (signal) {
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : file.size;
      const loaded = event.loaded;
      const percent =
        total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onProgress({ loaded, total, percent });
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
        resolve({ path });
        return;
      }
      reject(
        new DocumentImageUploadError(
          parseStorageErrorMessage(xhr.responseText),
          xhr.status,
        ),
      );
    });

    xhr.addEventListener("error", () => {
      reject(new DocumentImageUploadError("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new DocumentImageUploadError("Upload cancelled"));
    });

    xhr.send(formData);
  });
}
