import { Lightbulb } from "lucide-react";
import { useApp } from "@/context/AppContext";
import "./InsightDot.css";

type InsightDotProps = {
  count?: number;
};

export function InsightDot({ count }: InsightDotProps) {
  const { insightCount: contextCount, openPanel } = useApp();
  const insightCount = count ?? contextCount;

  if (insightCount <= 0) return null;

  return (
    <button
      type="button"
      className="insight-dot"
      onClick={() => openPanel("insights")}
      aria-label={`${insightCount} insights`}
      title={`${insightCount} insights`}
    >
      <Lightbulb size={14} strokeWidth={1.75} />
      <span className="insight-dot__count">{insightCount}</span>
    </button>
  );
}
