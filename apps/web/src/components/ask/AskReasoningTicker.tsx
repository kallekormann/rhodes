"use client";

import "./AskReasoningTicker.css";

export type AskReasoningStep = {
  label: string;
  verdict: "keep" | "skip";
};

type AskReasoningTickerProps = {
  steps: AskReasoningStep[];
  phase: "idle" | "searching" | "reranking" | "generating" | "computing";
  /** Tool-only Ask uses warmer “walk through” copy while streaming. */
  mode?: "tools" | "knowledge";
};

export function AskReasoningTicker({
  steps,
  phase,
  mode = "knowledge",
}: AskReasoningTickerProps) {
  if (phase === "idle") return null;
  // Knowledge path: hide ticker once we're only streaming tokens with no steps left.
  if (phase === "generating" && steps.length === 0 && mode !== "tools") return null;

  const showSearching = phase === "searching" && steps.length === 0;
  const showComputing = phase === "computing";
  const showToolWalkthrough = phase === "generating" && mode === "tools";

  return (
    <div className="ask-reasoning-ticker" role="status" aria-live="polite">
      <div className="ask-reasoning-ticker__header">
        {(phase === "searching" ||
          phase === "reranking" ||
          phase === "computing" ||
          showToolWalkthrough) && (
          <span className="ask-reasoning-ticker__spinner" aria-hidden="true" />
        )}
        <span className="ask-reasoning-ticker__heading">
          {showComputing
            ? "Working it out…"
            : showSearching
              ? "Searching your library and documents…"
              : showToolWalkthrough
                ? "Walking you through it…"
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
