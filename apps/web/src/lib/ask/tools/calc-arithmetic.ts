import { evaluate } from "mathjs";
import type { AskTool, AskToolResult } from "./types";

function runArithmetic(expression: string): AskToolResult {
  try {
    const value = evaluate(expression);
    const formatted =
      typeof value === "number"
        ? Number.isFinite(value)
          ? String(value)
          : "undefined"
        : String(value);
    return {
      tool: "calc_arithmetic",
      ok: true,
      summary: `${expression} = ${formatted}`,
      data: { expression, value: formatted },
    };
  } catch (error) {
    return {
      tool: "calc_arithmetic",
      ok: false,
      summary: `Could not evaluate "${expression}": ${
        error instanceof Error ? error.message : "invalid expression"
      }`,
    };
  }
}

function pctOfExpression(text: string): string | null {
  const pct = text.match(/([\d.]+)\s*%\s*of\s*([\d.]+)/i);
  if (!pct) return null;
  return `(${pct[1]} / 100) * ${pct[2]}`;
}

function sqrtExpression(text: string): string | null {
  const sqrt = text.match(/(?:square\s+root\s+of|sqrt)\s*\(?\s*([\d.]+)\s*\)?/i);
  if (!sqrt) return null;
  return `sqrt(${sqrt[1]})`;
}

/** Match pure/simple math like 1+1, (2*3)/4, sqrt(16), 20% of 50 */
export const calcArithmeticTool: AskTool = {
  id: "calc_arithmetic",
  description: "Evaluate arithmetic expressions, percentages, roots, and basic math",
  match(question) {
    const q = question.trim();

    // Prefer structured patterns before free-form "what is …"
    const pct = pctOfExpression(q);
    if (pct) return { expression: pct };

    const sqrt = sqrtExpression(q);
    if (sqrt) return { expression: sqrt };

    // "what is 1+1" / "calculate 2*3"
    const explicit = q.match(
      /(?:^|\b)(?:what(?:'| i)?s|calculate|compute|eval(?:uate)?)\s+(.+?)(?:\?|$)/i,
    );
    if (explicit?.[1]) {
      const raw = explicit[1].replace(/[?=]+$/g, "").trim();
      const fromPct = pctOfExpression(raw);
      if (fromPct) return { expression: fromPct };
      const fromSqrt = sqrtExpression(raw);
      if (fromSqrt) return { expression: fromSqrt };
      if (isSimpleMathExpr(raw)) {
        return { expression: normalizeExpr(raw) };
      }
    }

    // Bare expression only — digits/operators, no prose (avoids "days between 2026-01-01…")
    const bare = q.replace(/\s+/g, " ").replace(/[?=]+$/g, "").trim();
    if (
      bare.length <= 80 &&
      isSimpleMathExpr(bare) &&
      /[+\-*/^%]/.test(bare)
    ) {
      return { expression: normalizeExpr(bare) };
    }

    return null;
  },
  execute(args) {
    const expression =
      args && typeof args === "object" && "expression" in args
        ? String((args as { expression: string }).expression)
        : "";
    return runArithmetic(expression);
  },
};

/** Digits and math operators only (optional sqrt/abs). No English words. */
function isSimpleMathExpr(expr: string): boolean {
  const stripped = expr.replace(/\b(sqrt|abs)\b/gi, "").replace(/\s+/g, "");
  return (
    /^[\d+\-*/().,%^√]+$/i.test(stripped) &&
    /\d/.test(expr) &&
    /[+\-*/^%√]/.test(expr)
  );
}

function normalizeExpr(raw: string): string {
  return raw
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/√\s*\(?\s*([\d.]+)\s*\)?/g, "sqrt($1)")
    .replace(/\^/g, "^")
    .trim();
}
