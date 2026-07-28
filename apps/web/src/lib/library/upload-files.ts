export async function uploadLibraryFiles(
  workspaceId: string,
  files: File[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspace_id", workspaceId);

    const response = await fetch("/app/api/library/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof data.error === "string" ? data.error : "Upload failed";
      return { ok: false, error: message };
    }
  }

  return { ok: true };
}
