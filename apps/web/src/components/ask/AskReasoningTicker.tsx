"use client";

import "./AskReasoningTicker.css";

export type AskReasoningStep = {
  label: string;
  verdict: "keep" | "skip";
};

type AskReasoningTickerProps = {
  step: AskReasoningStep | null;
  phase: "idle" | "searching" | "reranking" | "generating";
};

export function AskReasoningTicker({ step, phase }: AskReasoningTickerProps) {
  if (phase === "idle" || phase === "generating") return null;

  const label =
    step?.label ??
    (phase === "searching" ? "Searching your library and documents…" : "Checking sources…");
  const verdict = step?.verdict;

  return (
    <div className="ask-reasoning-ticker" role="status" aria-live="polite">
      <span className="ask-reasoning-ticker__spinner" aria-hidden="true" />
      <span className="ask-reasoning-ticker__label">{label}</span>
      {verdict === "keep" && (
        <span className="ask-reasoning-ticker__verdict" aria-label="Included">
          ✓
        </span>
      )}
      {verdict === "skip" && (
        <span
          className="ask-reasoning-ticker__verdict ask-reasoning-ticker__verdict--skip"
          aria-label="Skipped"
        >
          ✗
        </span>
      )}
    </div>
  );
}
