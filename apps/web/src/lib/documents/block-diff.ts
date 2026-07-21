/**
 * Compare TipTap JSON trees by stable blockId (Phase 09 Wave B).
 */

export type BlockDiffKind =
  | "unchanged"
  | "changed"
  | "only_mine"
  | "only_theirs";

export type BlockDiffEntry = {
  blockId: string;
  kind: BlockDiffKind;
  type: string;
  minePreview: string;
  theirsPreview: string;
};

type TipTapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
};

function plainFromNode(node: TipTapNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(plainFromNode).join("");
}

function previewText(node: TipTapNode, max = 100): string {
  const text = plainFromNode(node).replace(/\s+/g, " ").trim();
  if (!text) {
    return node.type === "horizontalRule"
      ? "Divider"
      : node.type === "image"
        ? "Image"
        : `(${node.type ?? "block"})`;
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function topLevelBlocks(
  doc: Record<string, unknown> | null | undefined,
): Array<{ blockId: string; node: TipTapNode }> {
  if (!doc || typeof doc !== "object") return [];
  const content = (doc as TipTapNode).content;
  if (!Array.isArray(content)) return [];

  const blocks: Array<{ blockId: string; node: TipTapNode }> = [];
  content.forEach((node, index) => {
    const attrs = node.attrs ?? {};
    const rawId = attrs.blockId;
    const blockId =
      typeof rawId === "string" && rawId.length > 0
        ? rawId
        : `__index_${index}`;
    blocks.push({ blockId, node });
  });
  return blocks;
}

function nodesEqual(a: TipTapNode, b: TipTapNode): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffDocumentBlocks(
  mine: Record<string, unknown> | null | undefined,
  theirs: Record<string, unknown> | null | undefined,
): BlockDiffEntry[] {
  const mineBlocks = topLevelBlocks(mine);
  const theirsBlocks = topLevelBlocks(theirs);
  const mineMap = new Map(mineBlocks.map((b) => [b.blockId, b.node]));
  const theirsMap = new Map(theirsBlocks.map((b) => [b.blockId, b.node]));

  const ids = [
    ...new Set([...mineMap.keys(), ...theirsMap.keys()]),
  ];

  const entries: BlockDiffEntry[] = ids.map((blockId) => {
    const mineNode = mineMap.get(blockId);
    const theirsNode = theirsMap.get(blockId);

    if (mineNode && theirsNode) {
      const changed = !nodesEqual(mineNode, theirsNode);
      return {
        blockId,
        kind: changed ? "changed" : "unchanged",
        type: mineNode.type ?? theirsNode.type ?? "block",
        minePreview: previewText(mineNode),
        theirsPreview: previewText(theirsNode),
      };
    }

    if (mineNode) {
      return {
        blockId,
        kind: "only_mine",
        type: mineNode.type ?? "block",
        minePreview: previewText(mineNode),
        theirsPreview: "",
      };
    }

    return {
      blockId,
      kind: "only_theirs",
      type: theirsNode?.type ?? "block",
      minePreview: "",
      theirsPreview: previewText(theirsNode!),
    };
  });

  return entries.filter((entry) => entry.kind !== "unchanged");
}

export function blockDiffKindLabel(kind: BlockDiffKind): string {
  switch (kind) {
    case "changed":
      return "Changed in both";
    case "only_mine":
      return "Only in yours";
    case "only_theirs":
      return "Only in theirs";
    default:
      return "Unchanged";
  }
}
