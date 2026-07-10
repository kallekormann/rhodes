import { useState } from "react";
import { AskComposer, type AskComposerStatus } from "./AskComposer";
import "./AskComposer.css";

type ShowcaseState = {
  label: string;
  value: string;
  status: AskComposerStatus;
  pending: boolean;
};

export function AskComposerShowcase() {
  const [draft, setDraft] = useState("How does this connect to Reforge Growth?");
  const [demoPending, setDemoPending] = useState(false);
  const [demoStatus, setDemoStatus] = useState<AskComposerStatus>("idle");

  const staticStates: ShowcaseState[] = [
    { label: "Default — empty", value: "", status: "idle", pending: false },
    { label: "With message — send enabled", value: "Summarize my Q3 spec.", status: "idle", pending: false },
    { label: "Thinking… — send disabled", value: "What changed since Q2?", status: "thinking", pending: true },
    { label: "Searching… — send disabled", value: "Find library matches.", status: "searching", pending: true },
  ];

  const runDemoSend = () => {
    if (!draft.trim() || demoPending) return;
    setDemoPending(true);
    setDemoStatus("thinking");
    window.setTimeout(() => setDemoStatus("searching"), 1200);
    window.setTimeout(() => {
      setDemoPending(false);
      setDemoStatus("idle");
      setDraft("");
    }, 2800);
  };

  return (
    <div className="ask-composer-showcase">
      {staticStates.map((state) => (
        <div key={state.label} className="ask-composer-showcase__item">
          <span className="ask-composer-showcase__label">{state.label}</span>
          <AskComposer
            value={state.value}
            onChange={() => {}}
            onSend={() => {}}
            status={state.status}
            pending={state.pending}
          />
        </div>
      ))}
      <div className="ask-composer-showcase__item">
        <span className="ask-composer-showcase__label">Interactive — send to simulate status</span>
        <AskComposer
          value={draft}
          onChange={setDraft}
          onSend={runDemoSend}
          status={demoStatus}
          pending={demoPending}
        />
      </div>
    </div>
  );
}
