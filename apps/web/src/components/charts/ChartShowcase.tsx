"use client";

import {
  RhodesAreaChart,
  RhodesBarChart,
  ChartFrame,
  RhodesLineChart,
  RhodesScatterChart,
} from "./ChartFrame";
import "./ChartFrame.css";

const lineData = [
  { month: "Jan", balance: 1000 },
  { month: "Mar", balance: 1180 },
  { month: "May", balance: 1390 },
  { month: "Jul", balance: 1640 },
  { month: "Sep", balance: 1930 },
  { month: "Nov", balance: 2270 },
];

const barData = [
  { i: 1, value: 12 },
  { i: 2, value: 19 },
  { i: 3, value: 8 },
  { i: 4, value: 15 },
  { i: 5, value: 11 },
];

const scatterData = [
  { x: 1, y: 2.1 },
  { x: 2, y: 3.4 },
  { x: 3, y: 2.8 },
  { x: 4, y: 4.1 },
  { x: 5, y: 3.6 },
];

export function ChartShowcase() {
  return (
    <div className="chart-showcase">
      <RhodesLineChart
        title="Line — compound growth"
        data={lineData}
        xKey="month"
        yKeys={["balance"]}
      />
      <RhodesBarChart title="Bar — values" data={barData} xKey="i" yKeys={["value"]} />
      <RhodesAreaChart
        title="Area — same series"
        data={lineData}
        xKey="month"
        yKeys={["balance"]}
      />
      <RhodesScatterChart
        title="Scatter — sample"
        data={scatterData}
        xKey="x"
        yKeys={["y"]}
      />
      <ChartFrame title="Empty state" empty height={160} />
      <ChartFrame title="Error state" error="Could not load series" height={160} />
    </div>
  );
}
