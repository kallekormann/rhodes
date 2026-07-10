import { useState } from "react";
import { AskComposer } from "./AskComposer";
import { ChatMessageBubble } from "./ChatMessageBubble";
import "./AskComposer.css";
import "./ChatMessageBubble.css";
import "./AskPanelShowcase.css";

export function AskPanelShowcase() {
  const [draft, setDraft] = useState("");

  return (
    <div className="ask-panel-showcase">
      <div className="ask-panel-showcase__thread">
        <ChatMessageBubble role="user">
          <p>Summarize connections between my Q3 spec and library sources.</p>
        </ChatMessageBubble>
        <ChatMessageBubble role="rhodes">
          <p>
            Based on <a href="#">Reforge Growth.pdf</a>, your ARR targets align with the
            activation experiments in Post-Experiment Q2.
          </p>
        </ChatMessageBubble>
      </div>
      <AskComposer
        value={draft}
        onChange={setDraft}
        onSend={() => setDraft("")}
        placeholder="Ask a question…"
      />
    </div>
  );
}
