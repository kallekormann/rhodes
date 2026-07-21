import type { AskTool, AskToolResult } from "./types";
import { calcArithmeticTool } from "./calc-arithmetic";
import { calcUnitTool } from "./calc-unit";
import { calcDatetimeTool } from "./calc-datetime";
import { calcStatisticsTool } from "./calc-statistics";
import { calcRoiTool } from "./calc-roi";
import { calcCompoundInterestTool } from "./calc-compound";
import { calcAbExperimentTool } from "./calc-ab-experiment";
import { classifyAskIntent, isToolOnlyQuestion } from "./intent";
import { formatToolNarration, formatToolOnlyReply } from "./narrate";

export type { AskIntent } from "./intent";
export { classifyAskIntent, isToolOnlyQuestion };
export { formatToolNarration, formatToolOnlyReply };

export const ASK_TOOLS: AskTool[] = [
  calcAbExperimentTool,
  calcArithmeticTool,
  calcUnitTool,
  calcDatetimeTool,
  calcStatisticsTool,
  calcRoiTool,
  calcCompoundInterestTool,
];

const MAX_TOOLS = 2;

/** Rule-based tool selection (reliable on small local models). */
export async function runMatchingAskTools(
  question: string,
): Promise<AskToolResult[]> {
  const results: AskToolResult[] = [];
  for (const tool of ASK_TOOLS) {
    if (results.filter((r) => r.ok).length >= MAX_TOOLS) break;
    const args = tool.match(question);
    if (args == null) continue;
    const result = await tool.execute(args);
    if (!result.ok) continue;
    results.push(result);
    // Experiment sizing is exclusive — don't also dump unrelated stats.
    if (result.tool === "calc_ab_experiment") break;
  }
  return results;
}

export function formatToolResultsForPrompt(results: AskToolResult[]): string {
  if (results.length === 0) return "";
  return results
    .map((result) => {
      const status = result.ok ? "ok" : "error";
      return `[Calculation — ${status}]\n${result.summary}`;
    })
    .join("\n\n");
}
