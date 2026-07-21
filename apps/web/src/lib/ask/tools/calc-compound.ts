import type { AskTool } from "./types";

export const calcCompoundInterestTool: AskTool = {
  id: "calc_compound_interest",
  description: "Future value with compound interest and optional monthly contributions",
  match(question) {
    if (!/compound|future value|invest/i.test(question)) return null;
    const nums = [...question.matchAll(/([\d]+(?:\.\d+)?)/g)].map((m) =>
      Number(m[1]),
    );
    // principal, annual rate %, years [, monthly contribution]
    if (nums.length < 3) return null;
    return {
      principal: nums[0],
      annualRatePct: nums[1],
      years: nums[2],
      monthly: nums[3] ?? 0,
    };
  },
  execute(args) {
    const { principal, annualRatePct, years, monthly } = args as {
      principal: number;
      annualRatePct: number;
      years: number;
      monthly: number;
    };
    const r = annualRatePct / 100 / 12;
    const n = Math.round(years * 12);
    let balance = principal;
    const series: Array<{ month: number; balance: number }> = [];
    for (let month = 1; month <= n; month += 1) {
      balance = balance * (1 + r) + monthly;
      if (month % Math.max(1, Math.floor(n / 12)) === 0 || month === n) {
        series.push({ month, balance: Number(balance.toFixed(2)) });
      }
    }

    return {
      tool: "calc_compound_interest",
      ok: true,
      summary: `Future value ≈ ${balance.toFixed(2)} after ${years} year(s) (principal ${principal}, ${annualRatePct}% APR, monthly +${monthly})`,
      data: { futureValue: Number(balance.toFixed(2)), months: n },
      chart: {
        type: "line",
        title: "Compound growth",
        series,
        xKey: "month",
        yKeys: ["balance"],
      },
    };
  },
};
