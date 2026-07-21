"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./ChartFrame.css";

export type ChartSeriesPoint = Record<string, string | number>;

export type AskChartPayload = {
  type: "line" | "bar" | "area" | "scatter";
  title: string;
  series: ChartSeriesPoint[];
  xKey: string;
  yKeys: string[];
};

type ChartFrameProps = {
  title?: string;
  empty?: boolean;
  error?: string | null;
  children?: ReactNode;
  className?: string;
  height?: number;
};

const ACCENT = "var(--color-accent)";
const ACCENT_2 = "var(--color-accent-hover)";
const GRID = "var(--color-border-subtle)";
const TICK = "var(--color-text-secondary)";

export function ChartFrame({
  title,
  empty,
  error,
  children,
  className = "",
  height = 220,
}: ChartFrameProps) {
  return (
    <figure className={`chart-frame ${className}`.trim()}>
      {title ? <figcaption className="chart-frame__title">{title}</figcaption> : null}
      <div className="chart-frame__body" style={{ height }}>
        {error ? (
          <p className="chart-frame__status chart-frame__status--error">{error}</p>
        ) : empty ? (
          <p className="chart-frame__status">No data</p>
        ) : (
          children
        )}
      </div>
    </figure>
  );
}

type ChartProps = {
  data: ChartSeriesPoint[];
  xKey: string;
  yKeys: string[];
  height?: number;
  title?: string;
};

function palette(index: number) {
  return index % 2 === 0 ? ACCENT : ACCENT_2;
}

export function RhodesLineChart({ data, xKey, yKeys, height = 220, title }: ChartProps) {
  return (
    <ChartFrame title={title} empty={data.length === 0} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fill: TICK, fontSize: 11 }} />
          <YAxis tick={{ fill: TICK, fontSize: 11 }} width={40} />
          <Tooltip />
          <Legend />
          {yKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={palette(index)}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function RhodesBarChart({ data, xKey, yKeys, height = 220, title }: ChartProps) {
  return (
    <ChartFrame title={title} empty={data.length === 0} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fill: TICK, fontSize: 11 }} />
          <YAxis tick={{ fill: TICK, fontSize: 11 }} width={40} />
          <Tooltip />
          <Legend />
          {yKeys.map((key, index) => (
            <Bar key={key} dataKey={key} fill={palette(index)} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function RhodesAreaChart({ data, xKey, yKeys, height = 220, title }: ChartProps) {
  return (
    <ChartFrame title={title} empty={data.length === 0} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fill: TICK, fontSize: 11 }} />
          <YAxis tick={{ fill: TICK, fontSize: 11 }} width={40} />
          <Tooltip />
          <Legend />
          {yKeys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={palette(index)}
              fill={palette(index)}
              fillOpacity={0.18}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function RhodesScatterChart({ data, xKey, yKeys, height = 220, title }: ChartProps) {
  const yKey = yKeys[0] ?? "y";
  return (
    <ChartFrame title={title} empty={data.length === 0} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fill: TICK, fontSize: 11 }} name={xKey} />
          <YAxis dataKey={yKey} tick={{ fill: TICK, fontSize: 11 }} width={40} name={yKey} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill={ACCENT} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Map Ask tool chart payloads to sticker-sheet primitives. */
export function AskChartBlock({ chart }: { chart: AskChartPayload }) {
  const common = {
    data: chart.series,
    xKey: chart.xKey,
    yKeys: chart.yKeys,
    title: chart.title,
    height: 200,
  };

  switch (chart.type) {
    case "bar":
      return <RhodesBarChart {...common} />;
    case "area":
      return <RhodesAreaChart {...common} />;
    case "scatter":
      return <RhodesScatterChart {...common} />;
    case "line":
    default:
      return <RhodesLineChart {...common} />;
  }
}
