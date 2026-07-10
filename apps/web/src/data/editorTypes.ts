export type EditorComment = {
  id: string;
  blockId: string;
  start: number;
  end: number;
  anchorText: string;
  text: string;
  author: string;
  createdAt: string;
};

export type TextBlock = { id: string; kind: "text"; content: string };
export type H2Block = { id: string; kind: "h2"; content: string };
export type DividerBlock = { id: string; kind: "divider" };
export type ImageBlock = { id: string; kind: "image" };
export type TableBlock = {
  id: string;
  kind: "table";
  rows: number;
  cols: number;
  cells: string[][];
};

export type EditorBlock = TextBlock | H2Block | DividerBlock | ImageBlock | TableBlock;

export function createTableCells(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

export const initialEditorComments: EditorComment[] = [
  {
    id: "c1",
    blockId: "p-3",
    start: 0,
    end: 21,
    anchorText: "Onboarding completion",
    text: "Can we link this metric to the Q2 baseline?",
    author: "Kalle",
    createdAt: "2h ago",
  },
  {
    id: "c2",
    blockId: "p-3",
    start: 23,
    end: 36,
    anchorText: "time-to-value",
    text: "Define how we measure this for the next sprint.",
    author: "Growth team",
    createdAt: "1d ago",
  },
];
