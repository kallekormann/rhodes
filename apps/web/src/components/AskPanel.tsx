"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { AskComposer } from "@/components/AskComposer";
import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { AskMarkdown } from "@/components/ask/AskMarkdown";
import { AskReasoningTicker } from "@/components/ask/AskReasoningTicker";
import { AskSourcesLine } from "@/components/ask/AskSourcesLine";
import { AskChartBlock } from "@/components/charts/ChartFrame";
import { hasAskEngagedToday } from "@/lib/ask/engagement";
import { useAskChat } from "@/hooks/useAskChat";
import "@/components/AskComposer.css";
import "@/components/ChatMessageBubble.css";
import "@/components/ask/AskReasoningTicker.css";
import "@/components/ask/AskSourcesLine.css";
import "@/components/charts/ChartFrame.css";
import "@/components/ask/AskMarkdown.css";

type AskPanelProps = {
  workspaceId: string | null;
  askPrefill?: string;
  onConsumeAskPrefill?: () => void;
};

/** Workspace-scoped Ask thread — usable from editor RightPanel or global Rhodes shell. */
export function AskPanel({
  workspaceId,
  askPrefill,
  onConsumeAskPrefill,
}: AskPanelProps) {
  const { session } = useApp();
  const {
    messages,
    pending,
    pendingPhase,
    askMode,
    reasoningSteps,
    error,
    sendMessage,
  } = useAskChat(workspaceId);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const displayName = session.displayName || "there";
  const engagedToday = hasAskEngagedToday();

  useEffect(() => {
    if (!askPrefill) return;
    setDraft(askPrefill);
    onConsumeAskPrefill?.();
  }, [askPrefill, onConsumeAskPrefill]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, reasoningSteps]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || pending) return;
    void sendMessage(text);
    setDraft("");
  };

  const welcomeMessage = engagedToday
    ? `Hi again, ${displayName}. What would you like to explore?`
    : `Hi ${displayName}, I'm Rhodes. Ask me anything. I'll answer using your library sources and documents, with citations when I can.`;

  return (
    <div className="panel-tab panel-tab--ask">
      <div className="panel-tab__messages overlay-scrollbar">
        {messages.length === 0 && (
          <ChatMessageBubble role="rhodes">
            <p>{welcomeMessage}</p>
          </ChatMessageBubble>
        )}
        {messages.map((message) => (
          <div key={message.id} className="panel-tab__message-block">
            <ChatMessageBubble
              role={message.role === "assistant" ? "rhodes" : "user"}
            >
              {message.role === "assistant" ? (
                <div className="ask-markdown">
                  <AskMarkdown content={message.content || "…"} />
                </div>
              ) : (
                <p>{message.content}</p>
              )}
            </ChatMessageBubble>
            {message.role === "assistant" &&
              message.charts?.map((chart, index) => (
                <AskChartBlock
                  key={`${message.id}-chart-${index}`}
                  chart={chart}
                />
              ))}
            {message.role === "assistant" && message.sourcesUsed && (
              <AskSourcesLine sources={message.sourcesUsed} />
            )}
          </div>
        ))}
        <AskReasoningTicker
          steps={reasoningSteps}
          phase={pendingPhase}
          mode={askMode}
        />
        {error && <p className="caption">{error}</p>}
        <div ref={messagesEndRef} />
      </div>
      <AskComposer
        className="panel-tab__composer"
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        pending={pending}
      />
    </div>
  );
}
