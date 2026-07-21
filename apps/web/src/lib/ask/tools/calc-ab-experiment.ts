import type { AskTool, AskToolResult } from "./types";

/** Approximate inverse CDF for standard normal at common power/alpha points. */
function zForTail(probability: number): number {
  const table: Array<[number, number]> = [
    [0.8, 0.841621],
    [0.85, 1.036433],
    [0.9, 1.281552],
    [0.95, 1.644854],
    [0.975, 1.959964],
    [0.99, 2.326348],
  ];
  let best = table[0][1];
  let bestDist = Infinity;
  for (const [p, z] of table) {
    const dist = Math.abs(p - probability);
    if (dist < bestDist) {
      bestDist = dist;
      best = z;
    }
  }
  return best;
}

/**
 * Two-proportion z-test sample size per variant (equal split).
 * Relative lift: treatment = baseline * (1 + relativeLift).
 */
export function abSampleSizePerVariant(input: {
  baselineRate: number;
  relativeLift: number;
  alpha?: number;
  power?: number;
}): number {
  const alpha = input.alpha ?? 0.05;
  const power = input.power ?? 0.8;
  const p1 = input.baselineRate;
  const p2 = p1 * (1 + input.relativeLift);
  const delta = Math.abs(p2 - p1);
  if (p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1 || delta < 1e-12) {
    throw new Error("Baseline and lift must produce valid rates between 0 and 1");
  }

  const zAlpha = zForTail(1 - alpha / 2);
  const zBeta = zForTail(power);
  const pooled = (p1 + p2) / 2;
  const numerator =
    zAlpha * Math.sqrt(2 * pooled * (1 - pooled)) +
    zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((numerator * numerator) / (delta * delta));
}

function parsePercentValue(raw: string): number {
  return Number(raw) / 100;
}

function parseUsers(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function parsePower(q: string): number {
  const powerMatch = q.match(/([\d.]+)\s*%\s*(?:statistical\s+)?power/i);
  return powerMatch ? Number(powerMatch[1]) / 100 : 0.8;
}

function parseAlpha(q: string): number {
  const alphaMatch =
    q.match(/(?:alpha|significance(?:\s+level)?)\s*[:=(]?\s*([\d.]+)/i) ??
    q.match(/p\s*[<=]\s*([\d.]+)/i);
  if (!alphaMatch) return 0.05;
  const raw = Number(alphaMatch[1]);
  return raw > 1 ? raw / 100 : raw;
}

function parseTraffic(q: string): number | null {
  const trafficMatch =
    // "Daily traffic per variant 1500" / "traffic per variant: 1500"
    q.match(
      /(?:daily\s+)?traffic\s+per\s+(?:variant|arm|group)\s*[:=]?\s*([\d,]+)/i,
    ) ??
    // "1500 users per variant per day" / "1500 user/day"
    q.match(
      /([\d,]+)\s*(?:users?|visitors?|sessions?)\s*(?:per\s+)?(?:variant|arm|group)\s*(?:per\s+day|\/\s*day|daily)/i,
    ) ??
    q.match(
      /([\d,]+)\s*(?:users?|visitors?|sessions?)\s*\/\s*(?:variant|arm|group)\s*\/\s*day/i,
    ) ??
    q.match(/([\d,]+)\s*users?\s*\/\s*day/i) ??
    // "per variant 1500 users/day"
    q.match(
      /per\s+(?:variant|arm|group)\s*[:=]?\s*([\d,]+)\s*(?:users?|visitors?)?(?:\s*\/\s*day|\s*per\s*day)?/i,
    );
  return trafficMatch ? parseUsers(trafficMatch[1]) : null;
}

function parseGivenSampleSize(q: string): number | null {
  const labeled =
    q.match(
      /required\s+sample\s*size\s*[:=]?\s*([\d,]+)\s*(?:unique\s+)?(?:users?|visitors?)?\s*(?:per\s+variant)?/i,
    ) ??
    q.match(
      /([\d,]+)\s*(?:unique\s+)?users?\s+per\s+variant/i,
    );
  if (!labeled) return null;
  const n = parseUsers(labeled[1]);
  // Ignore tiny numbers that are clearly not sample sizes
  return n >= 100 ? n : null;
}

function parseRelativeLift(q: string): number | null {
  const liftMatch =
    q.match(/mde\s*[:=]?\s*([\d.]+)\s*%/i) ??
    q.match(/([\d.]+)\s*%\s*relative\s+lift/i) ??
    q.match(
      /minimum\s+detectable\s+effect(?:\s*\([^)]*\))?\s*[:=]?\s*([\d.]+)\s*%/i,
    ) ??
    q.match(
      /([\d.]+)\s*%\s*(?:relative\s+)?lift(?:\s+of\s+(?:teh\s+|the\s+)?bas\w*)?/i,
    ) ??
    q.match(/(?:detect(?:ing)?|need(?:s)?)\s+(?:a\s+)?([\d.]+)\s*%\s*lift/i);
  return liftMatch ? parsePercentValue(liftMatch[1]) : null;
}

/** Conversion-rate baseline only (must be a %). */
function parseBaselineRate(q: string): number | null {
  const match =
    q.match(
      /bas\w*\s*(?:conversion|rate|cvr)?\s*(?:is|=|:)\s*([\d.]+)\s*%/i,
    ) ??
    q.match(/([\d.]+)\s*%\s*(?:bas\w*|conversion\s*rate|cvr)\b/i);
  if (!match) return null;
  const rate = parsePercentValue(match[1]);
  // Sanity: conversion rates are almost never 80%/95% (power/confidence).
  if (rate >= 0.5) return null;
  return rate;
}

function isContinuousMetric(q: string): boolean {
  return /\b(aov|average\s+order|eur|usd|gbp|€|\$|revenue|arpu|ltv)\b/i.test(q);
}

type AbArgs =
  | {
      mode: "proportion";
      baselineRate: number;
      relativeLift: number;
      trafficPerVariantPerDay: number | null;
      power: number;
      alpha: number;
      wantsDuration: boolean;
      givenN: number | null;
    }
  | {
      mode: "given_n";
      nPerVariant: number;
      trafficPerVariantPerDay: number | null;
      wantsDuration: boolean;
      relativeLift: number | null;
      continuous: boolean;
      baselineLabel: string | null;
    }
  | {
      mode: "continuous_needs_n_or_traffic";
      relativeLift: number | null;
      trafficPerVariantPerDay: number | null;
      wantsDuration: boolean;
      baselineLabel: string | null;
      power: number;
      alpha: number;
    };

export const calcAbExperimentTool: AskTool = {
  id: "calc_ab_experiment",
  description:
    "A/B test sample size and runtime — conversion-rate sizing, or use a stated sample size / explain AOV limits",
  match(question) {
    const q = question.trim();
    const looksLikeAb =
      /experiment|expeirment|a\/?\s*b\b|sample\s*size|how long|mde|detectable\s+effect|variant|statistical\s+power|basel|lift/i.test(
        q,
      );
    if (!looksLikeAb) return null;

    const wantsDuration =
      /how\s*long|hwo\s+long|how\s+lon\w*|take\s+to\s+reach|reach\s+signif|duration|run\s+for|days?\s+(?:to|until)|runtime|run\s*time|need(?:s)?\s+to\s+run|wil\w*\s+.{0,20}take/i.test(
        q,
      );

    const givenN = parseGivenSampleSize(q);
    const trafficPerVariantPerDay = parseTraffic(q);
    const relativeLift = parseRelativeLift(q);
    const baselineRate = parseBaselineRate(q);
    const continuous = isContinuousMetric(q);
    const power = parsePower(q);
    const alpha = parseAlpha(q);

    const moneyBaseline = q.match(
      /bas\w*[^.\n]{0,80}?([\d.]+)\s*(EUR|USD|GBP|€|\$)/i,
    );
    const baselineLabel = moneyBaseline
      ? `${moneyBaseline[1]} ${moneyBaseline[2]}`
      : null;

    // Prefer an explicitly stated sample size (common in experiment briefs).
    if (givenN != null) {
      return {
        mode: "given_n",
        nPerVariant: givenN,
        trafficPerVariantPerDay,
        wantsDuration,
        relativeLift,
        continuous,
        baselineLabel,
      } satisfies AbArgs;
    }

    // AOV / money baselines can't use the conversion-rate formula.
    if (continuous && baselineRate == null) {
      return {
        mode: "continuous_needs_n_or_traffic",
        relativeLift,
        trafficPerVariantPerDay,
        wantsDuration,
        baselineLabel,
        power,
        alpha,
      } satisfies AbArgs;
    }

    if (baselineRate == null || relativeLift == null) return null;

    return {
      mode: "proportion",
      baselineRate,
      relativeLift,
      trafficPerVariantPerDay,
      power,
      alpha,
      wantsDuration,
      givenN: null,
    } satisfies AbArgs;
  },
  execute(args) {
    const input = args as AbArgs;

    if (input.mode === "given_n") {
      const { nPerVariant, trafficPerVariantPerDay, wantsDuration } = input;
      let days: number | null = null;
      if (trafficPerVariantPerDay != null && trafficPerVariantPerDay > 0) {
        days = Math.ceil(nPerVariant / trafficPerVariantPerDay);
      }
      return {
        tool: "calc_ab_experiment",
        ok: true,
        summary:
          days != null
            ? `Given ${nPerVariant.toLocaleString("en-US")}/variant → ≈ ${days} days at ${trafficPerVariantPerDay!.toLocaleString("en-US")}/day`
            : `Given sample size ${nPerVariant.toLocaleString("en-US")} per variant; need daily traffic for runtime`,
        data: {
          mode: "given_n",
          nPerVariant,
          totalUsers: nPerVariant * 2,
          days,
          trafficPerVariantPerDay,
          wantsDuration,
          relativeLift: input.relativeLift,
          continuous: input.continuous,
          baselineLabel: input.baselineLabel,
        },
      } satisfies AskToolResult;
    }

    if (input.mode === "continuous_needs_n_or_traffic") {
      return {
        tool: "calc_ab_experiment",
        ok: true,
        summary:
          "AOV/continuous metric — need stated sample size or traffic; proportion formula does not apply",
        data: {
          mode: "continuous_needs_n_or_traffic",
          relativeLift: input.relativeLift,
          trafficPerVariantPerDay: input.trafficPerVariantPerDay,
          wantsDuration: input.wantsDuration,
          baselineLabel: input.baselineLabel,
          power: input.power,
          alpha: input.alpha,
        },
      } satisfies AskToolResult;
    }

    try {
      const nPerVariant = abSampleSizePerVariant({
        baselineRate: input.baselineRate,
        relativeLift: input.relativeLift,
        alpha: input.alpha,
        power: input.power,
      });
      const treatmentRate = input.baselineRate * (1 + input.relativeLift);
      const absoluteLift = treatmentRate - input.baselineRate;

      let days: number | null = null;
      if (
        input.trafficPerVariantPerDay != null &&
        input.trafficPerVariantPerDay > 0
      ) {
        days = Math.ceil(nPerVariant / input.trafficPerVariantPerDay);
      }

      const baselinePct = (input.baselineRate * 100).toPrecision(3);
      const treatmentPct = (treatmentRate * 100).toPrecision(3);
      const liftPct = (input.relativeLift * 100).toPrecision(3);
      const absLiftPct = (absoluteLift * 100).toPrecision(3);
      const powerPct = Math.round(input.power * 100);
      const confPct = Math.round((1 - input.alpha) * 100);

      const summaryParts = [
        `Need ~${nPerVariant.toLocaleString("en-US")} users per variant`,
        `${baselinePct}% → ${treatmentPct}% (${liftPct}% relative / ${absLiftPct}pp absolute)`,
        `${powerPct}% power, ${confPct}% confidence`,
      ];
      if (days != null) {
        summaryParts.push(
          `≈ ${days} day${days === 1 ? "" : "s"} at ${input.trafficPerVariantPerDay!.toLocaleString("en-US")}/variant/day`,
        );
      }

      return {
        tool: "calc_ab_experiment",
        ok: true,
        summary: summaryParts.join("; "),
        data: {
          mode: "proportion",
          baselineRate: input.baselineRate,
          treatmentRate,
          relativeLift: input.relativeLift,
          absoluteLift,
          nPerVariant,
          totalUsers: nPerVariant * 2,
          days,
          trafficPerVariantPerDay: input.trafficPerVariantPerDay,
          power: input.power,
          alpha: input.alpha,
          wantsDuration: input.wantsDuration,
        },
      } satisfies AskToolResult;
    } catch (error) {
      return {
        tool: "calc_ab_experiment",
        ok: false,
        summary:
          error instanceof Error
            ? error.message
            : "Could not calculate experiment sample size",
      };
    }
  },
};
