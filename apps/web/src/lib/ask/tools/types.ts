export type AskToolResult = {
  tool: string;
  ok: boolean;
  summary: string;
  data?: unknown;
  chart?: {
    type: "line" | "bar" | "area" | "scatter";
    title: string;
    series: Array<Record<string, string | number>>;
    xKey: string;
    yKeys: string[];
  };
};

export type AskTool = {
  id: string;
  description: string;
  /** Return null if this tool should not run for the question. */
  match: (question: string) => unknown | null;
  execute: (args: unknown) => AskToolResult | Promise<AskToolResult>;
};
