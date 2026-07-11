const TIKA_TIMEOUT_MS = 60_000;

export async function extractTextWithTika(
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const tikaUrl = (process.env.TIKA_URL ?? "http://localhost:9998").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIKA_TIMEOUT_MS);

  try {
    const response = await fetch(`${tikaUrl}/tika`, {
      method: "PUT",
      headers: {
        Accept: "text/plain",
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: Buffer.from(bytes),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Tika extraction failed: ${response.status}`);
    }

    const text = await response.text();
    return text.replace(/\u0000/g, "").trim();
  } finally {
    clearTimeout(timer);
  }
}
