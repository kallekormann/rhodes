/** Stream a finished reply in word-ish chunks so tool answers feel like chat. */
export async function streamTextAsTokens(
  text: string,
  send: (payload: Record<string, unknown>) => void,
  options?: { delayMs?: number },
): Promise<void> {
  const delayMs = options?.delayMs ?? 14;
  // Keep markdown tokens together enough to avoid broken **bold** mid-stream.
  const chunks = text.match(/\*\*[^*]+\*\*|\s+|[^\s*]+|\*/g) ?? [text];

  for (const chunk of chunks) {
    send({ type: "token", token: chunk });
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
