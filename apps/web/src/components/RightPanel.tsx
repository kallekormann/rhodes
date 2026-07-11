"use client";

import { PanelRightClose } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp, type PanelTab } from "@/context/AppContext";
import type { StoredDocumentComment } from "@/lib/documents/comments";
import { AskComposer, type AskComposerStatus } from "./AskComposer";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { CommentsTab } from "./CommentsTab";
import type { TemplateMetadata } from "@/lib/templates/metadata";
import { PropertiesTab } from "./PropertiesTab";
import { IconButton } from "./IconButton";
import { TabBar } from "./TabBar";
import "./AskComposer.css";
import "./ChatMessageBubble.css";
import "./RightPanel.css";

const tabOptions: { value: PanelTab; label: string }[] = [
  { value: "insights", label: "Insights" },
  { value: "ask", label: "Ask" },
  { value: "comments", label: "Comments" },
  { value: "properties", label: "Properties" },
];

type ChatMessage = {
  id: string;
  role: "user" | "rhodes";
  text: string;
  rich?: boolean;
};

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    text: "Summarize connections between my Q3 spec and library sources.",
  },
  {
    id: "m2",
    role: "rhodes",
    text: "Based on Reforge Growth.pdf, your ARR targets align with the activation experiments in Post-Experiment Q2.",
    rich: true,
  },
];

type RightPanelProps = {
  comments?: StoredDocumentComment[];
  selectedCommentId?: string | null;
  hoverCommentId?: string | null;
  onSelectComment?: (commentId: string) => void;
  onHoverComment?: (commentId: string | null) => void;
  onAddReply?: (parentId: string, text: string) => void;
  onRemoveComment?: (commentId: string) => void;
  workspaceId?: string | null;
  propertiesMode?: "document" | "template";
  documentMetadata?: Record<string, unknown> | null;
  createdAtLabel?: string | null;
  createdByLabel?: string | null;
  templateDescription?: string | null;
  templateMetadata?: TemplateMetadata;
  onMetadataFieldChange?: (fieldKey: string, value: string | null) => void;
  onTemplateDescriptionChange?: (description: string) => void;
  onTemplateMetadataChange?: (metadata: TemplateMetadata) => void;
};

export function RightPanel({
  comments = [],
  selectedCommentId = null,
  hoverCommentId = null,
  onSelectComment,
  onHoverComment,
  onAddReply,
  onRemoveComment,
  workspaceId = null,
  propertiesMode = "document",
  documentMetadata = null,
  createdAtLabel = null,
  createdByLabel = null,
  templateDescription = null,
  templateMetadata,
  onMetadataFieldChange,
  onTemplateDescriptionChange,
  onTemplateMetadataChange,
}: RightPanelProps) {
  const { panelOpen, panelTab, setPanelTab, closePanel, headerHidden } = useApp();

  return (
    <aside
      className={`right-panel ${panelOpen ? "right-panel--open" : ""} ${!headerHidden ? "right-panel--below-header" : ""}`}
      aria-hidden={!panelOpen}
    >
      <div className="right-panel__header">
        <TabBar
          className="tab-bar--panel"
          options={tabOptions}
          value={panelTab}
          onChange={setPanelTab}
        />
        <IconButton icon={PanelRightClose} label="Close panel" onClick={closePanel} iconSize={18} />
      </div>

      <div className="right-panel__content overlay-scrollbar" key={panelTab}>
        {panelTab === "insights" && <InsightsTab />}
        {panelTab === "ask" && <AskTab />}
        {panelTab === "comments" && (
          <CommentsTab
            comments={comments}
            selectedCommentId={selectedCommentId}
            hoverCommentId={hoverCommentId}
            onSelectComment={onSelectComment ?? (() => {})}
            onHoverComment={onHoverComment ?? (() => {})}
            onAddReply={onAddReply ?? (() => {})}
            onRemoveComment={onRemoveComment ?? (() => {})}
          />
        )}
        {panelTab === "properties" && (
          <PropertiesTab
            workspaceId={workspaceId}
            mode={propertiesMode}
            metadata={documentMetadata}
            createdAtLabel={createdAtLabel}
            createdByLabel={createdByLabel}
            templateDescription={templateDescription}
            templateMetadata={templateMetadata}
            onMetadataFieldChange={onMetadataFieldChange}
            onTemplateDescriptionChange={onTemplateDescriptionChange}
            onTemplateMetadataChange={onTemplateMetadataChange}
          />
        )}
      </div>
    </aside>
  );
}

function InsightsTab() {
  return (
    <div className="panel-tab">
      <article className="insight-card">
        <div className="insight-card__score">94%</div>
        <div>
          <h4 className="insight-card__title">Reforge Growth.pdf</h4>
          <p className="insight-card__reason">
            Why: matches your ARR growth framework and Q3 objectives.
          </p>
        </div>
      </article>
      <hr className="divider" />
      <article className="insight-card">
        <div className="insight-card__score">87%</div>
        <div>
          <h4 className="insight-card__title">Post-Experiment Q2</h4>
          <p className="insight-card__reason">
            Why: references the same activation metrics you discuss here.
          </p>
        </div>
      </article>
    </div>
  );
}

function AskTab() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<AskComposerStatus>("idle");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || pending) return;

    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, role: "user", text }]);
    setDraft("");
    setPending(true);
    setStatus("thinking");

    timersRef.current.push(
      window.setTimeout(() => setStatus("searching"), 1200),
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}-ai`,
            role: "rhodes",
            text: "I found three relevant sources in your library. The strongest match is your Q2 experiment write-up.",
          },
        ]);
        setPending(false);
        setStatus("idle");
      }, 2800),
    );
  };

  return (
    <div className="panel-tab panel-tab--ask">
      <div className="panel-tab__messages">
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} role={message.role}>
            {message.rich ? (
              <p>
                Based on <a href="#">Reforge Growth.pdf</a>, your ARR targets align with the
                activation experiments in Post-Experiment Q2.
              </p>
            ) : (
              <p>{message.text}</p>
            )}
          </ChatMessageBubble>
        ))}
      </div>
      <AskComposer
        className="panel-tab__composer"
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        status={status}
        pending={pending}
      />
    </div>
  );
}
