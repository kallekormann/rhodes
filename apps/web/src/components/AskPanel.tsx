"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { History, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AskComposer } from "@/components/AskComposer";
import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { AskMarkdown } from "@/components/ask/AskMarkdown";
import { AskReasoningTicker } from "@/components/ask/AskReasoningTicker";
import { AskSourcesLine } from "@/components/ask/AskSourcesLine";
import { IconButton } from "@/components/IconButton";
import { hasAskEngagedToday } from "@/lib/ask/engagement";
import { useAskChat } from "@/hooks/useAskChat";
import "@/components/AskComposer.css";
import "@/components/ChatMessageBubble.css";
import "@/components/ask/AskReasoningTicker.css";
import "@/components/ask/AskSourcesLine.css";
import "@/components/ask/AskMarkdown.css";
import "./AskPanel.css";

const AskChartBlock = dynamic(
  () =>
    import("@/components/charts/ChartFrame").then((m) => ({
      default: m.AskChartBlock,
    })),
  { ssr: false },
);

type AskPanelProps = {
  workspaceId: string | null;
  askPrefill?: string;
  onConsumeAskPrefill?: () => void;
};

function formatConversationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  // App is English-only until Phase 10 i18n — do not use browser locale.
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day");
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}

/** Workspace-scoped Ask — editor RightPanel and global Rhodes shell. */
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
    view,
    conversations,
    isBlankChat,
    sendMessage,
    openHistory,
    closeHistory,
    startNewChat,
    openConversation,
    deleteConversation,
  } = useAskChat(workspaceId, session.userId);
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
    if (view !== "chat") return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, reasoningSteps, view]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || pending) return;
    void sendMessage(text);
    setDraft("");
  };

  const welcomeMessage = engagedToday
    ? `Hi again, ${displayName}. What would you like to explore?`
    : `Hi ${displayName}, I'm Rhodes. Ask me anything. I'll answer using your library sources and documents, with citations when I can.`;

  const showNewChat = view === "history" || (view === "chat" && !isBlankChat);

  return (
    <div className="panel-tab panel-tab--ask">
      <div className="ask-panel__toolbar">
        <div className="ask-panel__toolbar-actions">
          <IconButton
            icon={History}
            label={view === "history" ? "Back to chat" : "Conversation history"}
            size="small"
            active={view === "history"}
            onClick={() => {
              if (view === "history") {
                closeHistory();
              } else {
                void openHistory();
              }
            }}
          />
          {showNewChat && (
            <IconButton
              icon={Plus}
              label="New chat"
              size="small"
              onClick={() => void startNewChat()}
            />
          )}
        </div>
      </div>

      {view === "history" ? (
        <div className="ask-panel__history overlay-scrollbar">
          {conversations.length === 0 ? (
            <p className="ask-panel__history-empty caption">
              No conversations yet. Start a new chat to begin.
            </p>
          ) : (
            <ul className="ask-panel__history-list">
              {conversations.map((row) => (
                <li key={row.id} className="ask-panel__history-row">
                  <button
                    type="button"
                    className="ask-panel__history-open"
                    onClick={() => void openConversation(row.id)}
                  >
                    <span className="ask-panel__history-title">{row.title}</span>
                    <span className="ask-panel__history-meta">
                      {formatConversationTime(row.updated_at)}
                    </span>
                    {row.preview ? (
                      <span className="ask-panel__history-preview">
                        {row.preview}
                      </span>
                    ) : null}
                  </button>
                  <IconButton
                    icon={Trash2}
                    label={`Delete ${row.title}`}
                    size="small"
                    className="ask-panel__history-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (
                        !window.confirm(
                          `Delete “${row.title}”? This cannot be undone.`,
                        )
                      ) {
                        return;
                      }
                      void deleteConversation(row.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
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
            {error && (
              <p className="caption" role="alert">
                {error}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>
          <AskComposer
            className="panel-tab__composer"
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            pending={pending}
          />
        </>
      )}
    </div>
  );
}
