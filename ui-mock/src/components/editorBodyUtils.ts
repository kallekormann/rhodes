export function computeDropIndex(
  clientY: number,
  blockIds: string[],
  wrapperRefs: Record<string, HTMLElement | null>,
): number {
  for (let i = 0; i < blockIds.length; i++) {
    const el = wrapperRefs[blockIds[i]!];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) return i;
  }
  return blockIds.length;
}

export function reorderBlocks<T extends { id: string }>(
  blocks: T[],
  fromId: string,
  toIndex: number,
): T[] {
  const fromIndex = blocks.findIndex((block) => block.id === fromId);
  if (fromIndex === -1) return blocks;

  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return blocks;

  let insertAt = toIndex;
  if (fromIndex < insertAt) insertAt -= 1;
  next.splice(insertAt, 0, moved);
  return next;
}
