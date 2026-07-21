import type { AskTool } from "./types";

export const calcRoiTool: AskTool = {
  id: "calc_roi_breakeven",
  description: "ROI and break-even calculations",
  match(question) {
    const q = question.trim();

    // Labeled break-even: "break-even fixed 10000 price 40 variable 15"
    if (/break[\s-]?even/i.test(q)) {
      const labeled = q.match(
        /fixed\s*(?:cost\s*)?([\d.]+).{0,40}?price\s*(?:per\s*unit\s*)?([\d.]+).{0,40}?variable\s*(?:cost\s*)?([\d.]+)/i,
      );
      if (labeled) {
        return {
          mode: "breakeven" as const,
          fixed: Number(labeled[1]),
          price: Number(labeled[2]),
          variable: Number(labeled[3]),
        };
      }
      const nums = [...q.matchAll(/([\d]+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
      if (nums.length >= 3) {
        return {
          mode: "breakeven" as const,
          fixed: nums[0],
          price: nums[1],
          variable: nums[2],
        };
      }
    }

    // ROI — allow light typos like "OI gain of…"
    if (/r?oi\b|return\s+on\s+investment/i.test(q)) {
      const labeled = q.match(
        /gain\s*(?:of\s*)?([\d.]+).{0,40}?cost\s*(?:of\s*)?([\d.]+)/i,
      );
      if (labeled) {
        return {
          mode: "roi" as const,
          gain: Number(labeled[1]),
          cost: Number(labeled[2]),
        };
      }
      const nums = [...q.matchAll(/([\d]+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
      if (nums.length >= 2) {
        return { mode: "roi" as const, gain: nums[0], cost: nums[1] };
      }
    }

    return null;
  },
  execute(args) {
    const input = args as {
      mode: "roi" | "breakeven";
      gain?: number;
      cost?: number;
      fixed?: number;
      price?: number;
      variable?: number;
    };

    if (input.mode === "roi" && input.gain != null && input.cost != null && input.cost !== 0) {
      const roi = ((input.gain - input.cost) / input.cost) * 100;
      return {
        tool: "calc_roi_breakeven",
        ok: true,
        summary: `ROI = ((${input.gain} − ${input.cost}) / ${input.cost}) × 100 = ${roi.toFixed(2)}%`,
        data: { roi, gain: input.gain, cost: input.cost },
      };
    }

    if (
      input.mode === "breakeven" &&
      input.fixed != null &&
      input.price != null &&
      input.variable != null
    ) {
      const contrib = input.price - input.variable;
      if (contrib <= 0) {
        return {
          tool: "calc_roi_breakeven",
          ok: false,
          summary: "Break-even undefined: price must exceed variable cost",
        };
      }
      const units = input.fixed / contrib;
      return {
        tool: "calc_roi_breakeven",
        ok: true,
        summary: `Break-even = ${input.fixed} / (${input.price} − ${input.variable}) = ${units.toFixed(2)} units`,
        data: {
          units,
          fixed: input.fixed,
          price: input.price,
          variable: input.variable,
          contribution: contrib,
        },
      };
    }

    return {
      tool: "calc_roi_breakeven",
      ok: false,
      summary: "Need numbers for ROI (gain, cost) or break-even (fixed, price, variable)",
    };
  },
};
