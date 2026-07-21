import { useState } from "react";
import { AskComposer } from "./AskComposer";
import "./AskComposer.css";

type ShowcaseState = {
  label: string;
  value: string;
  pending: boolean;
};

export function AskComposerShowcase() {
  const [draft, setDraft] = useState("How does this connect to Reforge Growth?");
  const [demoPending, setDemoPending] = useState(false);

  const staticStates: ShowcaseState[] = [
    { label: "Default — empty", value: "", pending: false },
    { label: "With message — send enabled", value: "Summarize my Q3 spec.", pending: false },
    { label: "Pending — send disabled", value: "What changed since Q2?", pending: true },
  ];

  const runDemoSend = () => {
    if (!draft.trim() || demoPending) return;
    setDemoPending(true);
    window.setTimeout(() => {
      setDemoPending(false);
      setDraft("");
    }, 1800);
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
            pending={state.pending}
          />
        </div>
      ))}
      <div className="ask-composer-showcase__item">
        <span className="ask-composer-showcase__label">Interactive — send to simulate pending</span>
        <AskComposer
          value={draft}
          onChange={setDraft}
          onSend={runDemoSend}
          pending={demoPending}
        />
      </div>
    </div>
  );
}
