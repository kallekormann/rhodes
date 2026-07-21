import type { AskTool, AskToolResult } from "./types";

const LENGTH: Record<string, number> = {
  m: 1,
  meter: 1,
  meters: 1,
  km: 1000,
  kilometer: 1000,
  kilometers: 1000,
  cm: 0.01,
  millimeter: 0.001,
  mm: 0.001,
  mi: 1609.344,
  mile: 1609.344,
  miles: 1609.344,
  ft: 0.3048,
  foot: 0.3048,
  feet: 0.3048,
  in: 0.0254,
  inch: 0.0254,
  inches: 0.0254,
};

const WEIGHT: Record<string, number> = {
  kg: 1,
  kilogram: 1,
  kilograms: 1,
  g: 0.001,
  gram: 0.001,
  grams: 0.001,
  lb: 0.45359237,
  lbs: 0.45359237,
  pound: 0.45359237,
  pounds: 0.45359237,
  oz: 0.028349523125,
  ounce: 0.028349523125,
  ounces: 0.028349523125,
};

function convertTemp(value: number, from: string, to: string): number | null {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  let celsius = value;
  if (f === "f" || f === "fahrenheit") celsius = ((value - 32) * 5) / 9;
  else if (f === "k" || f === "kelvin") celsius = value - 273.15;
  else if (f !== "c" && f !== "celsius") return null;

  if (t === "c" || t === "celsius") return celsius;
  if (t === "f" || t === "fahrenheit") return (celsius * 9) / 5 + 32;
  if (t === "k" || t === "kelvin") return celsius + 273.15;
  return null;
}

function convertWithMap(
  value: number,
  from: string,
  to: string,
  map: Record<string, number>,
): number | null {
  const f = map[from.toLowerCase()];
  const t = map[to.toLowerCase()];
  if (f == null || t == null) return null;
  return (value * f) / t;
}

export const calcUnitTool: AskTool = {
  id: "calc_unit_convert",
  description: "Convert length, weight, or temperature units",
  match(question) {
    const m = question.match(
      /([\d.]+)\s*([a-z°]+)\s+(?:to|in|into)\s+([a-z°]+)/i,
    );
    if (!m) return null;
    return {
      value: Number(m[1]),
      from: m[2].replace(/°/g, "").toLowerCase(),
      to: m[3].replace(/°/g, "").toLowerCase(),
    };
  },
  execute(args) {
    const { value, from, to } = args as {
      value: number;
      from: string;
      to: string;
    };
    let result =
      convertTemp(value, from, to) ??
      convertWithMap(value, from, to, LENGTH) ??
      convertWithMap(value, from, to, WEIGHT);

    if (result == null || !Number.isFinite(result)) {
      return {
        tool: "calc_unit_convert",
        ok: false,
        summary: `Unsupported conversion: ${value} ${from} → ${to}`,
      } satisfies AskToolResult;
    }

    const rounded = Number(result.toPrecision(8));
    return {
      tool: "calc_unit_convert",
      ok: true,
      summary: `${value} ${from} = ${rounded} ${to}`,
      data: { value, from, to, result: rounded },
    };
  },
};
