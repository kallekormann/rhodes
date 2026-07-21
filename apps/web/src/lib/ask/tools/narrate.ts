import type { AskToolResult } from "./types";

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function narrateOne(result: AskToolResult): string {
  const data = asRecord(result.data);

  switch (result.tool) {
    case "calc_arithmetic": {
      const expression = String(data.expression ?? "");
      const value = String(data.value ?? "");
      if (expression && value) {
        return `I ran the numbers — **${expression}** comes out to **${value}**.`;
      }
      break;
    }
    case "calc_unit_convert": {
      const value = data.value;
      const from = data.from;
      const to = data.to;
      const converted = data.result;
      if (value != null && from && to && converted != null) {
        return `I converted that: **${value} ${from}** is **${converted} ${to}**.`;
      }
      break;
    }
    case "calc_datetime": {
      if (typeof data.days === "number") {
        const start = data.start ? String(data.start) : null;
        const end = data.end ? String(data.end) : null;
        if (start && end) {
          return `I counted the days between ${start} and ${end}: **${Math.abs(data.days)}** day${Math.abs(data.days) === 1 ? "" : "s"}.`;
        }
        return `I counted it out — that's **${Math.abs(data.days)}** day${Math.abs(data.days) === 1 ? "" : "s"}.`;
      }
      if (data.date) {
        return `Working from that date, I land on **${data.date}**.`;
      }
      break;
    }
    case "calc_statistics": {
      const n = data.n;
      const meanVal = data.mean;
      const medianVal = data.median;
      const sd = data.sd;
      if (n != null && meanVal != null && medianVal != null && sd != null) {
        return [
          `Here's what I got from those ${n} values:`,
          `- Mean: **${Number(meanVal).toPrecision(6)}**`,
          `- Median: **${Number(medianVal).toPrecision(6)}**`,
          `- Standard deviation: **${Number(sd).toPrecision(6)}**`,
          `The chart below just plots each raw value as a bar (1→${n}) so you can see the spread around that mean — taller bars are higher numbers, not the SD itself.`,
        ].join("\n\n");
      }
      break;
    }
    case "calc_roi_breakeven": {
      if (typeof data.roi === "number") {
        const gain = data.gain;
        const cost = data.cost;
        if (typeof gain === "number" && typeof cost === "number") {
          return `ROI is how much you made relative to what you put in: **((${gain} − ${cost}) / ${cost}) × 100 = ${data.roi.toFixed(2)}%**.`;
        }
        return `I calculated the return — **ROI is ${data.roi.toFixed(2)}%**.`;
      }
      if (typeof data.units === "number") {
        const fixed = data.fixed;
        const price = data.price;
        const variable = data.variable;
        if (
          typeof fixed === "number" &&
          typeof price === "number" &&
          typeof variable === "number"
        ) {
          return [
            `Break-even is when contribution covers fixed cost.`,
            `Each unit contributes **${price} − ${variable} = ${price - variable}**, so **${fixed} ÷ ${price - variable} ≈ ${data.units.toFixed(2)} units**.`,
          ].join("\n\n");
        }
        return `I worked out the break-even point: **${data.units.toFixed(2)} units**.`;
      }
      break;
    }
    case "calc_compound_interest": {
      const futureValue = data.futureValue;
      const months = data.months;
      if (futureValue != null) {
        const years =
          typeof months === "number"
            ? (months / 12).toFixed(months % 12 === 0 ? 0 : 1)
            : null;
        const growthLine = years
          ? `I compounded that forward — after about **${years} year${years === "1" ? "" : "s"}**, you'd have roughly **${futureValue}**.`
          : `I compounded that forward — you'd end up around **${futureValue}**.`;
        return `${growthLine}\n\nThe chart shows balance over time (months on the x-axis) so you can see how the compounding curve builds.`;
      }
      break;
    }
    case "calc_ab_experiment": {
      const mode = data.mode;

      if (mode === "given_n") {
        const nPerVariant = data.nPerVariant;
        const days = data.days;
        const traffic = data.trafficPerVariantPerDay;
        if (typeof nPerVariant !== "number") break;
        const nFmt = nPerVariant.toLocaleString("en-US");
        const lines = [
          `Your brief already states the required sample size: **${nFmt} users per variant** (**${(nPerVariant * 2).toLocaleString("en-US")}** total). I'll trust that number instead of re-deriving it.`,
        ];
        if (data.continuous || data.baselineLabel) {
          lines.push(
            `That's wise here — the baseline looks like an **AOV / money metric** (${data.baselineLabel ?? "continuous"}), not a conversion rate, so the usual proportion sample-size formula wouldn't apply cleanly.`,
          );
        }
        if (typeof days === "number" && typeof traffic === "number") {
          lines.push(
            `At **${traffic.toLocaleString("en-US")} users per variant per day**, runtime is **${nFmt} ÷ ${traffic.toLocaleString("en-US")} ≈ ${days} day${days === 1 ? "" : "s"}**.`,
          );
        } else {
          lines.push(
            `To turn that into **how long to run**, I still need **daily traffic per variant** (e.g. “~2,000 users/variant/day”). Then days ≈ sample size ÷ daily traffic.`,
          );
        }
        return lines.join("\n\n");
      }

      if (mode === "continuous_needs_n_or_traffic") {
        const lift =
          typeof data.relativeLift === "number"
            ? `${(data.relativeLift * 100).toPrecision(3)}%`
            : null;
        const lines = [
          `This reads like a **continuous metric** experiment${data.baselineLabel ? ` (baseline **${data.baselineLabel}**)` : ""}${lift ? ` with a **${lift}** relative MDE` : ""} — not a conversion-rate test.`,
          `I shouldn't plug AOV into the two-proportion sample-size formula (that would invent a nonsense “baseline %”).`,
          `Share either the **required sample size per variant** from your calculator, or **daily traffic per variant**, and I can turn it into a runtime. Power **${Math.round(Number(data.power ?? 0.8) * 100)}%** / alpha **${data.alpha ?? 0.05}** noted.`,
        ];
        return lines.join("\n\n");
      }

      const nPerVariant = data.nPerVariant;
      const days = data.days;
      const baselineRate = data.baselineRate;
      const treatmentRate = data.treatmentRate;
      const relativeLift = data.relativeLift;
      const absoluteLift = data.absoluteLift;
      const traffic = data.trafficPerVariantPerDay;
      const power = data.power;
      const alpha = data.alpha;
      if (
        typeof nPerVariant !== "number" ||
        typeof baselineRate !== "number" ||
        typeof treatmentRate !== "number"
      ) {
        break;
      }
      const baselinePct = (baselineRate * 100).toPrecision(3);
      const treatmentPct = (treatmentRate * 100).toPrecision(3);
      const liftPct =
        typeof relativeLift === "number"
          ? (relativeLift * 100).toPrecision(3)
          : "?";
      const absPct =
        typeof absoluteLift === "number"
          ? (absoluteLift * 100).toPrecision(3)
          : "?";
      const powerPct =
        typeof power === "number" ? Math.round(power * 100) : 80;
      const confPct =
        typeof alpha === "number" ? Math.round((1 - alpha) * 100) : 95;
      const nFmt = nPerVariant.toLocaleString("en-US");
      const totalFmt = (nPerVariant * 2).toLocaleString("en-US");

      const lines = [
        `Here's how I'd size this.`,
        `**1. Translate the lift**\nYour **${baselinePct}%** baseline with a **${liftPct}%** relative lift means the treatment needs to land around **${treatmentPct}%** — that's only a **${absPct}pp** absolute gap. Small gaps need more data.`,
        `**2. Sample size**\nFor a 50/50 split I'm using a two-proportion test at **${powerPct}%** power and **${confPct}%** confidence: enough people that if the lift is real we're likely to see it, without being too jumpy on noise. That comes out to about **${nFmt} users per variant** (**${totalFmt}** total).`,
      ];
      if (typeof days === "number" && typeof traffic === "number") {
        const trafficFmt = traffic.toLocaleString("en-US");
        lines.push(
          `**3. Runtime**\nAt **${trafficFmt} users per variant per day**, divide sample size by daily traffic: **${nFmt} ÷ ${trafficFmt} ≈ ${days} day${days === 1 ? "" : "s"}**.`,
        );
        lines.push(
          `So I'd plan on roughly **${days} day${days === 1 ? "" : "s"}** — and a little buffer if traffic wobbles.`,
        );
      } else if (data.wantsDuration) {
        lines.push(
          `**3. Runtime**\nShare daily traffic per variant and I can turn that sample size into days.`,
        );
      }
      return lines.join("\n\n");
    }
    default:
      break;
  }

  const summary = result.summary.replace(/^Could not /, "I couldn't ");
  return `I got this: **${summary}**.`;
}

/** Rhodes-voice reply for tool-only Ask — first person, no tool jargon. */
export function formatToolNarration(results: AskToolResult[]): string {
  return results
    .filter((result) => result.ok)
    .map(narrateOne)
    .join("\n\n");
}

/** @deprecated Use formatToolNarration */
export function formatToolOnlyReply(results: AskToolResult[]): string {
  return formatToolNarration(results);
}
