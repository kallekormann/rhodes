import type { AskTool } from "./types";

function parseDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const calcDatetimeTool: AskTool = {
  id: "calc_datetime",
  description: "Days between dates or add/subtract days from a date",
  match(question) {
    const between = question.match(
      /(?:days?\s+between|between)\s+(\d{4}-\d{2}-\d{2})\s+(?:and|to)\s+(\d{4}-\d{2}-\d{2})/i,
    );
    if (between) {
      return { mode: "between" as const, start: between[1], end: between[2] };
    }

    const add = question.match(
      /(?:add|plus)\s+(\d+)\s+days?\s+(?:to|from)\s+(\d{4}-\d{2}-\d{2})/i,
    );
    if (add) {
      return {
        mode: "add" as const,
        days: Number(add[1]),
        date: add[2],
      };
    }

    const duration = question.match(
      /(?:duration|how long|experiment)\s+(?:from\s+)?(\d{4}-\d{2}-\d{2})\s+(?:to|until|-)\s+(\d{4}-\d{2}-\d{2})/i,
    );
    if (duration) {
      return { mode: "between" as const, start: duration[1], end: duration[2] };
    }

    return null;
  },
  execute(args) {
    const input = args as {
      mode: "between" | "add";
      start?: string;
      end?: string;
      days?: number;
      date?: string;
    };

    if (input.mode === "between" && input.start && input.end) {
      const a = parseDate(input.start);
      const b = parseDate(input.end);
      if (!a || !b) {
        return {
          tool: "calc_datetime",
          ok: false,
          summary: "Could not parse one of the dates (use YYYY-MM-DD)",
        };
      }
      const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
      return {
        tool: "calc_datetime",
        ok: true,
        summary: `${Math.abs(days)} day(s) between ${input.start} and ${input.end}`,
        data: { days, start: input.start, end: input.end },
      };
    }

    if (input.mode === "add" && input.date && input.days != null) {
      const base = parseDate(input.date);
      if (!base) {
        return {
          tool: "calc_datetime",
          ok: false,
          summary: "Could not parse date (use YYYY-MM-DD)",
        };
      }
      base.setUTCDate(base.getUTCDate() + input.days);
      const next = base.toISOString().slice(0, 10);
      return {
        tool: "calc_datetime",
        ok: true,
        summary: `${input.date} + ${input.days} day(s) = ${next}`,
        data: { date: next },
      };
    }

    return {
      tool: "calc_datetime",
      ok: false,
      summary: "Unsupported date calculation",
    };
  },
};
