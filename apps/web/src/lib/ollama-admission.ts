/** Lightweight admission flag so Insights embeds yield while Ask is generating. */
let askActiveCount = 0;

export function beginAskOllamaWork(): void {
  askActiveCount += 1;
}

export function endAskOllamaWork(): void {
  askActiveCount = Math.max(0, askActiveCount - 1);
}

export function isAskOllamaActive(): boolean {
  return askActiveCount > 0;
}
