"use client";

import { PanelRightClose } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp, type PanelTab } from "@/context/AppContext";
import type { StoredDocumentComment } from "@/lib/documents/comments";
import type { CitationInsertInput } from "@/lib/documents/editor-commands";
import { useAskChat } from "@/hooks/useAskChat";
import type { InsightMatch } from "@/hooks/useInsights";
import type { TemplateMetadata } from "@/lib/templates/metadata";
import type { MetadataFieldValue } from "@/lib/metadata/schemas";
import { PropertiesTab } from "./PropertiesTab";
import { AskComposer, type AskComposerStatus } from "./AskComposer";
import { Button } from "./Button";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { CommentsTab } from "./CommentsTab";
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
  onMetadataFieldChange?: (fieldKey: string, value: MetadataFieldValue) => void;
  onTemplateDescriptionChange?: (description: string) => void;
  onTemplateMetadataChange?: (metadata: TemplateMetadata) => void;
  insights?: InsightMatch[];
  insightsLoading?: boolean;
  insightsError?: string | null;
  askPrefill?: string;
  onConsumeAskPrefill?: () => void;
  onInsertCitation?: (input: CitationInsertInput) => void;
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
  insights = [],
  insightsLoading = false,
  insightsError = null,
  askPrefill = "",
  onConsumeAskPrefill,
  onInsertCitation,
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
        {panelTab === "insights" && (
          <InsightsTab
            insights={insights}
            loading={insightsLoading}
            error={insightsError}
            onInsertCitation={onInsertCitation}
          />
        )}
        {panelTab === "ask" && (
          <AskTab
            workspaceId={workspaceId}
            askPrefill={askPrefill}
            onConsumeAskPrefill={onConsumeAskPrefill}
          />
        )}
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

function InsightsTab({
  insights,
  loading,
  error,
  onInsertCitation,
}: {
  insights: InsightMatch[];
  loading: boolean;
  error: string | null;
  onInsertCitation?: (input: CitationInsertInput) => void;
}) {
  const [quoteSelection, setQuoteSelection] = useState<{
    insight: InsightMatch;
    excerpt: string;
  } | null>(null);

  const handleTextSelection = (insight: InsightMatch) => {
    const selection = window.getSelection();
    const excerpt = selection?.toString().trim() ?? "";
    if (!excerpt) {
      setQuoteSelection(null);
      return;
    }
    setQuoteSelection({ insight, excerpt });
  };

  const handleInsertQuote = () => {
    if (!quoteSelection || !onInsertCitation) return;
    onInsertCitation({
      sourceId: quoteSelection.insight.item_id,
      sourceTitle: quoteSelection.insight.title,
      page: quoteSelection.insight.page_ref,
      excerpt: quoteSelection.excerpt,
    });
    setQuoteSelection(null);
    window.getSelection()?.removeAllRanges();
  };
  if (loading && insights.length === 0) {
    return (
      <div className="panel-tab">
        <p className="caption">Finding related sources…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-tab">
        <p className="caption">{error}</p>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="panel-tab">
        <p className="caption">
          Keep writing — Rhodes will surface related library sources and documents
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-tab panel-tab--insights">
      {insights.map((insight, index) => (
        <div key={`${insight.item_id}-${index}`}>
          {index > 0 && <hr className="divider" />}
          <article
            className="insight-card"
            onMouseUp={() => handleTextSelection(insight)}
          >
            <div className="insight-card__score">{insight.relevance_percent}%</div>
            <div>
              <h4 className="insight-card__title">{insight.title}</h4>
              <p className="insight-card__reason">{insight.matched_text}</p>
              {onInsertCitation && (
                <Button
                  variant="ghost"
                  className="insight-card__quote-btn"
                  onClick={() => {
                    onInsertCitation({
                      sourceId: insight.item_id,
                      sourceTitle: insight.title,
                      page: insight.page_ref,
                      excerpt: insight.matched_text.slice(0, 400),
                    });
                  }}
                >
                  Insert quote
                </Button>
              )}
            </div>
          </article>
        </div>
      ))}

      {quoteSelection && onInsertCitation && (
        <div className="insight-quote-bar">
          <span className="caption">Selected excerpt ready</span>
          <Button variant="secondary" onClick={handleInsertQuote}>
            Insert quote
          </Button>
        </div>
      )}
    </div>
  );
}

function AskTab({
  workspaceId,
  askPrefill,
  onConsumeAskPrefill,
}: {
  workspaceId: string | null;
  askPrefill?: string;
  onConsumeAskPrefill?: () => void;
}) {
  const { messages, pending, error, sendMessage } = useAskChat(workspaceId);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!askPrefill) return;
    setDraft(askPrefill);
    onConsumeAskPrefill?.();
  }, [askPrefill, onConsumeAskPrefill]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || pending) return;
    void sendMessage(text);
    setDraft("");
  };

  const status: AskComposerStatus = pending ? "thinking" : "idle";

  return (
    <div className="panel-tab panel-tab--ask">
      <div className="panel-tab__messages">
        {messages.length === 0 && (
          <p className="caption">
            Ask questions about your workspace. Answers cite library sources and documents only.
          </p>
        )}
        {messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            role={message.role === "assistant" ? "rhodes" : "user"}
          >
            <p>{message.content}</p>
          </ChatMessageBubble>
        ))}
        {error && <p className="caption">{error}</p>}
        <div ref={messagesEndRef} />
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
