import type { AskTool } from "./types";

function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function variance(values: number[], sample = true) {
  const m = mean(values);
  const denom = sample ? values.length - 1 : values.length;
  if (denom <= 0) return 0;
  return values.reduce((acc, v) => acc + (v - m) ** 2, 0) / denom;
}

function stddev(values: number[]) {
  return Math.sqrt(variance(values));
}

function pFromZ(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const tau =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        1.00002368 * t +
        0.37409196 * t ** 2 +
        0.09678418 * t ** 3 -
        0.18628806 * t ** 4 +
        0.27886807 * t ** 5 -
        1.13520398 * t ** 6 +
        1.48851587 * t ** 7 -
        0.82215223 * t ** 8 +
        0.17087277 * t ** 9,
    );
  const erfc = x >= 0 ? tau : 2 - tau;
  return Math.min(1, Math.max(0, erfc));
}

function parseNumberList(question: string): number[] | null {
  // Prefer an explicit list: "numbers 12, 15, 11"
  const listMatch = question.match(
    /(?:numbers?|data|values?|set)\s*[:=]?\s*\[?([\d.\s,]+)\]?/i,
  );
  // Comma lists need a space after commas so "110,000" is not split into 110 and 000.
  const raw =
    listMatch?.[1] ??
    question.match(/([\d]+(?:\.\d+)?(?:\s*,\s+[\d]+(?:\.\d+)?)+)/)?.[1];
  if (!raw) return null;
  const values = raw
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));
  return values.length >= 2 ? values : null;
}

export const calcStatisticsTool: AskTool = {
  id: "calc_statistics",
  description: "Mean, median, variance, standard deviation, and simple z/p significance",
  match(question) {
    // Don't steal experiment briefs (they often say "significance" + large sample sizes).
    if (
      /experiment|mde|sample\s*size|per\s+variant|aov|detectable\s+effect/i.test(
        question,
      )
    ) {
      return null;
    }

    const values = parseNumberList(question);
    if (!values) return null;
    if (
      /mean|average|median|variance|standard\s+deviation|std\s*dev|z-?score/i.test(
        question,
      )
    ) {
      return { values };
    }
    return null;
  },
  execute(args) {
    const { values } = args as { values: number[] };
    const m = mean(values);
    const med = median(values);
    const v = variance(values);
    const sd = stddev(values);
    const z = sd > 0 ? (values[0] - m) / sd : 0;
    const p = pFromZ(z);

    return {
      tool: "calc_statistics",
      ok: true,
      summary: `n=${values.length}; mean=${m.toPrecision(6)}; median=${med.toPrecision(6)}; sd=${sd.toPrecision(6)}; sample z(first vs mean)=${z.toPrecision(4)}; approx two-tailed p=${p.toPrecision(4)}`,
      data: { n: values.length, mean: m, median: med, variance: v, sd, z, p },
      chart: {
        type: "bar" as const,
        title: "Your data points",
        series: values.map((value, index) => ({
          i: index + 1,
          value,
        })),
        xKey: "i",
        yKeys: ["value"],
      },
    };
  },
};
