"use client";

import { Link2, PanelRightClose } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import type { StoredDocumentComment } from "@/lib/documents/comments";
import type { CitationInsertInput } from "@/lib/documents/editor-commands";
import {
  formatInsightExcerpt,
  insightOriginLabel,
} from "@/lib/insights/format";
import { openKnowledgeSourcePreview } from "@/lib/library/preview";
import { PANEL_TAB_OPTIONS } from "@/lib/panel-tabs";
import { useAskChat } from "@/hooks/useAskChat";
import { hasAskEngagedToday } from "@/lib/ask/engagement";
import type { InsightMatch } from "@/hooks/useInsights";
import type { TemplateMetadata } from "@/lib/templates/metadata";
import type { MetadataFieldValue, MetadataSchemaField, MetadataSchemaGroup } from "@/lib/metadata/schemas";
import type { MetadataFieldType } from "@/lib/metadata/schemas";
import { PropertiesTab, type PropertiesPanelStage } from "./PropertiesTab";
import type { ActivityNavigateTarget } from "./DocumentHistorySection";
import { AskComposer, type AskComposerStatus } from "./AskComposer";
import { Button } from "./Button";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { CommentsTab } from "./CommentsTab";
import { IconButton } from "./IconButton";
import { TabBar } from "./TabBar";
import "./AskComposer.css";
import "./ChatMessageBubble.css";
import "./RightPanel.css";

type MetadataSchemaWriteResult = { ok: boolean; error?: string };

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
  propertiesStage?: PropertiesPanelStage;
  onPropertiesStageChange?: (stage: PropertiesPanelStage) => void;
  documentMetadata?: Record<string, unknown> | null;
  metadataSchemas: MetadataSchemaField[];
  metadataGroups: MetadataSchemaGroup[];
  metadataSchemasLoading?: boolean;
  createMetadataSchema: (input: {
    field_label: string;
    field_type: MetadataFieldType;
    options?: string[] | { unit: string };
    ai_fill_enabled?: boolean;
  }) => Promise<MetadataSchemaWriteResult>;
  createMetadataGroup: (input: {
    group_label: string;
    repeatable?: boolean;
    fields: Array<{
      field_label: string;
      field_type: MetadataFieldType;
      sub_key?: string;
      options?: string[] | { unit: string };
      ai_fill_enabled?: boolean;
    }>;
  }) => Promise<MetadataSchemaWriteResult>;
  updateMetadataSchema: (
    schemaId: string,
    input: {
      field_label: string;
      field_type: MetadataFieldType;
      options?: string[] | { unit: string };
      ai_fill_enabled?: boolean;
    },
  ) => Promise<MetadataSchemaWriteResult>;
  updateMetadataGroup: (
    groupId: string,
    input: {
      group_label: string;
      fields: Array<{
        id?: string;
        field_label: string;
        field_type: MetadataFieldType;
        sub_key?: string;
        options?: string[] | { unit: string };
        ai_fill_enabled?: boolean;
      }>;
    },
  ) => Promise<MetadataSchemaWriteResult>;
  deleteMetadataSchema: (
    schemaId: string,
    purgeValues?: boolean,
  ) => Promise<MetadataSchemaWriteResult>;
  deleteMetadataGroup: (
    groupId: string,
    purgeValues?: boolean,
  ) => Promise<MetadataSchemaWriteResult>;
  createdAtLabel?: string | null;
  createdByLabel?: string | null;
  templateDescription?: string | null;
  templateMetadata?: TemplateMetadata;
  onMetadataFieldChange?: (fieldKey: string, value: MetadataFieldValue) => void;
  onMetadataGroupInstancesChange?: (metadata: Record<string, unknown>) => void;
  onTemplateDescriptionChange?: (description: string) => void;
  onTemplateMetadataChange?: (metadata: TemplateMetadata) => void;
  documentId?: string | null;
  onVersionRestored?: () => void;
  onNavigateToActivity?: (target: ActivityNavigateTarget) => void;
  insights?: InsightMatch[];
  insightsLoading?: boolean;
  insightsError?: string | null;
  insightsQueryText?: string;
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
  propertiesStage = "view",
  onPropertiesStageChange,
  documentMetadata = null,
  metadataSchemas,
  metadataGroups,
  metadataSchemasLoading = false,
  createMetadataSchema,
  createMetadataGroup,
  updateMetadataSchema,
  updateMetadataGroup,
  deleteMetadataSchema,
  deleteMetadataGroup,
  createdAtLabel = null,
  createdByLabel = null,
  templateDescription = null,
  templateMetadata,
  onMetadataFieldChange,
  onMetadataGroupInstancesChange,
  onTemplateDescriptionChange,
  onTemplateMetadataChange,
  documentId = null,
  onVersionRestored,
  onNavigateToActivity,
  insights = [],
  insightsLoading = false,
  insightsError = null,
  insightsQueryText = "",
  askPrefill = "",
  onConsumeAskPrefill,
  onInsertCitation,
}: RightPanelProps) {
  const { panelOpen, panelTab, setPanelTab, closePanel, headerHidden } = useApp();

  useEffect(() => {
    if (panelTab !== "properties" && propertiesStage !== "view") {
      onPropertiesStageChange?.("view");
    }
  }, [panelTab, propertiesStage, onPropertiesStageChange]);

  return (
    <aside
      className={`right-panel ${panelOpen ? "right-panel--open" : ""} ${!headerHidden ? "right-panel--below-header" : ""}`}
      aria-hidden={!panelOpen}
    >
      <div className="right-panel__header">
        <TabBar
          className="tab-bar--panel"
          options={PANEL_TAB_OPTIONS}
          value={panelTab}
          onChange={setPanelTab}
        />
        <IconButton icon={PanelRightClose} label="Close panel" onClick={closePanel} iconSize={18} />
      </div>

      <div
        className={`right-panel__content ${panelTab === "properties" ? "right-panel__content--properties" : "overlay-scrollbar"}`}
        key={panelTab}
      >
        {panelTab === "insights" && (
          <InsightsTab
            workspaceId={workspaceId}
            insights={insights}
            loading={insightsLoading}
            error={insightsError}
            queryText={insightsQueryText}
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
          <div className="panel-tab panel-tab--comments overlay-scrollbar">
            <CommentsTab
              comments={comments}
              selectedCommentId={selectedCommentId}
              hoverCommentId={hoverCommentId}
              onSelectComment={onSelectComment ?? (() => {})}
              onHoverComment={onHoverComment ?? (() => {})}
              onAddReply={onAddReply ?? (() => {})}
              onRemoveComment={onRemoveComment ?? (() => {})}
            />
          </div>
        )}
        {panelTab === "properties" && (
          <PropertiesTab
            mode={propertiesMode}
            stage={propertiesStage}
            onStageChange={onPropertiesStageChange}
            metadata={documentMetadata}
            metadataSchemas={metadataSchemas}
            metadataGroups={metadataGroups}
            metadataSchemasLoading={metadataSchemasLoading}
            createMetadataSchema={createMetadataSchema}
            createMetadataGroup={createMetadataGroup}
            updateMetadataSchema={updateMetadataSchema}
            updateMetadataGroup={updateMetadataGroup}
            deleteMetadataSchema={deleteMetadataSchema}
            deleteMetadataGroup={deleteMetadataGroup}
            createdAtLabel={createdAtLabel}
            createdByLabel={createdByLabel}
            templateDescription={templateDescription}
            templateMetadata={templateMetadata}
            onMetadataFieldChange={onMetadataFieldChange}
            onMetadataGroupInstancesChange={onMetadataGroupInstancesChange}
            onTemplateDescriptionChange={onTemplateDescriptionChange}
            onTemplateMetadataChange={onTemplateMetadataChange}
            documentId={documentId}
            onVersionRestored={onVersionRestored}
            onNavigateToActivity={onNavigateToActivity}
          />
        )}
      </div>
    </aside>
  );
}

function InsightsTab({
  workspaceId,
  insights,
  loading,
  error,
  queryText,
  onInsertCitation,
}: {
  workspaceId: string | null;
  insights: InsightMatch[];
  loading: boolean;
  error: string | null;
  queryText: string;
  onInsertCitation?: (input: CitationInsertInput) => void;
}) {
  const [quoteSelection, setQuoteSelection] = useState<{
    insight: InsightMatch;
    excerpt: string;
  } | null>(null);
  const [whyByKey, setWhyByKey] = useState<
    Record<string, { text: string; loading: boolean; expanded: boolean }>
  >({});

  const handleTextSelection = (insight: InsightMatch) => {
    const selection = window.getSelection();
    const excerpt = selection?.toString().trim() ?? "";
    if (!excerpt) {
      setQuoteSelection(null);
      return;
    }
    setQuoteSelection({ insight, excerpt });
  };

  const handleWhyRelevant = async (insight: InsightMatch) => {
    if (!workspaceId || queryText.trim().length < 20) return;

    const key = `${insight.item_id}-${insight.origin_type}`;
    setWhyByKey((current) => ({
      ...current,
      [key]: { text: "", loading: true, expanded: true },
    }));

    const response = await fetch("/app/api/insights/why-relevant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        query_text: queryText.slice(-500),
        match: insight,
      }),
    });

    if (!response.ok || !response.body) {
      setWhyByKey((current) => ({
        ...current,
        [key]: {
          text: formatInsightExcerpt(insight.matched_text, queryText, 320),
          loading: false,
          expanded: true,
        },
      }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;

        const payload = JSON.parse(line.slice(5).trim()) as {
          type?: string;
          token?: string;
          text?: string;
        };

        if (payload.type === "token" && payload.token) {
          text += payload.token;
          setWhyByKey((current) => ({
            ...current,
            [key]: { text, loading: true, expanded: true },
          }));
        }

        if (payload.type === "done" && payload.text) {
          text = payload.text;
        }
      }
    }

    setWhyByKey((current) => ({
      ...current,
      [key]: {
        text: text.trim() || formatInsightExcerpt(insight.matched_text, queryText, 320),
        loading: false,
        expanded: true,
      },
    }));
  };

  const buildCitation = (
    insight: InsightMatch,
    excerpt: string,
    placement: CitationInsertInput["placement"],
  ): CitationInsertInput => ({
    sourceId: insight.source_ref_id ?? insight.item_id,
    sourceRefId: insight.source_ref_id ?? insight.item_id,
    originType: insight.origin_type,
    sourceTitle: insight.title,
    page: insight.page_ref,
    excerpt,
    placement,
    queryContext: queryText,
  });

  const openInsightPreview = (insight: InsightMatch) => {
    openKnowledgeSourcePreview({
      originType: insight.origin_type,
      sourceRefId: insight.source_ref_id ?? insight.item_id,
      page: insight.page_ref,
    });
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
          {loading
            ? "Finding related sources…"
            : "Keep writing — Rhodes will surface related library sources and documents here."}
        </p>
      </div>
    );
  }

  return (
    <div className="panel-tab panel-tab--insights">
      {loading && (
        <p className="caption panel-tab__insights-status">Refreshing matches…</p>
      )}
      <div className="panel-tab__insights-scroll overlay-scrollbar">
        {insights.map((insight, index) => {
          const whyKey = `${insight.item_id}-${insight.origin_type}`;
          const whyState = whyByKey[whyKey];
          const excerpt = formatInsightExcerpt(insight.matched_text, queryText);

          return (
            <article
              key={`${insight.item_id}-${index}`}
              className="insight-card"
              onMouseUp={() => handleTextSelection(insight)}
            >
                <div className="insight-card__meta">
                  <span className="insight-card__score">{insight.relevance_percent}%</span>
                  <button
                    type="button"
                    className="insight-card__title insight-card__title--link"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => openInsightPreview(insight)}
                  >
                    {insight.title}
                  </button>
                  <span className="insight-card__origin">
                    {insightOriginLabel(insight.origin_type)}
                    {insight.page_ref != null ? ` · p.${insight.page_ref}` : ""}
                  </span>
                </div>
                <p className="insight-card__reason">{excerpt}</p>
                <div className="insight-card__footer">
                  <Button
                    type="button"
                    size="small"
                    variant="ghost"
                    className="insight-card__action-btn"
                    disabled={!workspaceId || whyState?.loading}
                    onClick={() => void handleWhyRelevant(insight)}
                  >
                    Why relevant?
                  </Button>
                  {onInsertCitation && (
                    <Button
                      type="button"
                      size="small"
                      variant="ghost"
                      icon={Link2}
                      className="insight-card__action-btn"
                      onClick={() => {
                        onInsertCitation(
                          buildCitation(
                            insight,
                            formatInsightExcerpt(insight.matched_text, queryText, 240),
                            "related-block",
                          ),
                        );
                      }}
                    >
                      Add reference
                    </Button>
                  )}
                </div>
                {whyState?.expanded && (
                  <p className="insight-card__why">
                    {whyState.loading ? "Thinking…" : whyState.text}
                  </p>
                )}
            </article>
          );
        })}
      </div>

      {quoteSelection && onInsertCitation && (
        <div className="insight-quote-bar">
          <span className="caption">Selected excerpt</span>
          <Button
            type="button"
            size="small"
            variant="ghost"
            icon={Link2}
            onClick={() => {
              onInsertCitation(
                buildCitation(quoteSelection.insight, quoteSelection.excerpt, "related-block"),
              );
              setQuoteSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            Add reference
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
  const { session } = useApp();
  const { messages, pending, error, sendMessage } = useAskChat(workspaceId);
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
  }, [messages, pending]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || pending) return;
    void sendMessage(text);
    setDraft("");
  };

  const status: AskComposerStatus = pending ? "thinking" : "idle";

  const welcomeMessage = engagedToday
    ? `Hi again, ${displayName}. What would you like to explore?`
    : `Hi ${displayName}, I'm Rhodes. Ask me anything. I'll answer using your library sources and documents, with citations when I can.`;

  return (
    <div className="panel-tab panel-tab--ask">
      <div className="panel-tab__messages">
        {messages.length === 0 && (
          <ChatMessageBubble role="rhodes">
            <p>{welcomeMessage}</p>
          </ChatMessageBubble>
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
