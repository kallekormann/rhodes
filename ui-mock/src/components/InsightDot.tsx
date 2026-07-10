import { Lightbulb } from "lucide-react";
import { useApp } from "../context/AppContext";
import "./InsightDot.css";

export function InsightDot() {
  const { insightCount, openPanel } = useApp();

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
