"use client";

import "./AskReasoningTicker.css";

export type AskReasoningStep = {
  label: string;
  verdict: "keep" | "skip";
};

type AskReasoningTickerProps = {
  steps: AskReasoningStep[];
  phase: "idle" | "searching" | "reranking" | "generating";
};

export function AskReasoningTicker({ steps, phase }: AskReasoningTickerProps) {
  if (phase === "idle") return null;
  if (phase === "generating" && steps.length === 0) return null;

  const showSearching = phase === "searching" && steps.length === 0;

  return (
    <div className="ask-reasoning-ticker" role="status" aria-live="polite">
      <div className="ask-reasoning-ticker__header">
        {(phase === "searching" || phase === "reranking") && (
          <span className="ask-reasoning-ticker__spinner" aria-hidden="true" />
        )}
        <span className="ask-reasoning-ticker__heading">
          {showSearching
            ? "Searching your library and documents…"
            : phase === "generating"
              ? "Writing answer…"
              : "Checking sources…"}
        </span>
      </div>
      {steps.length > 0 && (
        <ul className="ask-reasoning-ticker__steps">
          {steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className="ask-reasoning-ticker__step">
              <span className="ask-reasoning-ticker__label">{step.label}</span>
              {step.verdict === "keep" ? (
                <span className="ask-reasoning-ticker__verdict" aria-label="Included">
                  ✓
                </span>
              ) : (
                <span
                  className="ask-reasoning-ticker__verdict ask-reasoning-ticker__verdict--skip"
                  aria-label="Skipped"
                >
                  ✗
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
