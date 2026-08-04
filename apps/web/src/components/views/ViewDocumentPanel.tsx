"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, SlidersHorizontal, X } from "lucide-react";
import { getRecommendedTemplatesForView } from "@rhodes/shared/view-template-affinity";
import { SYSTEM_TEMPLATE_SEEDS } from "@rhodes/shared/system-templates";
import { EditorTitleField } from "@/components/EditorTitleField";
import { IconButton } from "@/components/IconButton";
import { IconLabelButton } from "@/components/IconLabelButton";
import { LoaderState } from "@/components/Loader";
import { useApp } from "@/context/AppContext";
import { useCreateDocument } from "@/hooks/useCreateDocument";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { TemplateRecord } from "@/hooks/useTemplates";
import {
  withUserMetadataValue,
  type MetadataFieldValue,
} from "@/lib/metadata/schemas";
import { EMPTY_DOCUMENT_CONTENT } from "@/lib/documents/schemas";
import type { ViewDocumentPanelProps } from "./view-document-panel-types";
import "./ViewDocumentPanel.css";

export type {
  ViewDocumentCreateContext,
  ViewDocumentPanelState,
  ViewDocumentPanelProps,
} from "./view-document-panel-types";

/** Mirrors PropertiesTab stage — keep local so we don't static-import PropertiesTab. */
type PropertiesPanelStage = "view" | "manage" | "add";

const TipTapEditor = dynamic(
  () =>
    import("@/components/editor/TipTapEditor").then((m) => ({
      default: m.TipTapEditor,
    })),
  { ssr: false, loading: () => <LoaderState label="Loading editor…" size="s" /> },
);

const PropertiesTab = dynamic(
  () =>
    import("@/components/PropertiesTab").then((m) => ({
      default: m.PropertiesTab,
    })),
  {
    ssr: false,
    loading: () => <LoaderState label="Loading properties…" size="s" />,
  },
);

function slugForTemplate(template: TemplateRecord): string | null {
  const metaSlug = template.metadata?.slug;
  if (typeof metaSlug === "string" && metaSlug.trim()) return metaSlug.trim();
  const seed = SYSTEM_TEMPLATE_SEEDS.find(
    (entry) => entry.name === template.name,
  );
  return seed?.slug ?? null;
}

function sortTemplatesForView(
  templates: TemplateRecord[],
  viewType: string,
): TemplateRecord[] {
  const recommended = getRecommendedTemplatesForView(viewType);
  const rank = new Map(recommended.map((slug, index) => [slug, index]));
  return [...templates].sort((a, b) => {
    const aSlug = slugForTemplate(a);
    const bSlug = slugForTemplate(b);
    const aRank = aSlug != null && rank.has(aSlug) ? rank.get(aSlug)! : 999;
    const bRank = bSlug != null && rank.has(bSlug) ? rank.get(bSlug)! : 999;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });
}

export function ViewDocumentPanel({
  state,
  onClose,
  onOpenFullPage,
  onDocumentCreated,
  onDocumentUpdated,
}: ViewDocumentPanelProps) {
  const {
    workspaceId,
    overviewTemplates,
    showToast,
    canWriteActiveScope,
    session,
  } = useApp();
  const { online } = useOnlineStatus(workspaceId);
  const { createDocument } = useCreateDocument(
    workspaceId,
    session.userId,
    online,
  );
  const {
    schemas,
    groups,
    loading: schemasLoading,
    createSchema,
    createGroup,
    updateSchema,
    updateGroup,
    deleteSchema,
    deleteGroup,
  } = useMetadataSchemas(workspaceId);

  const [creating, setCreating] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [title, setTitle] = useState("Untitled Document");
  const [content, setContent] = useState<Record<string, unknown>>(
    EMPTY_DOCUMENT_CONTENT as Record<string, unknown>,
  );
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesStage, setPropertiesStage] =
    useState<PropertiesPanelStage>("view");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<Record<string, unknown>>(
    EMPTY_DOCUMENT_CONTENT as Record<string, unknown>,
  );
  const loadedDocIdRef = useRef<string | null>(null);
  const showToastRef = useRef(showToast);
  const onCloseRef = useRef(onClose);
  showToastRef.current = showToast;
  onCloseRef.current = onClose;

  const onDocumentUpdatedRef = useRef(onDocumentUpdated);
  onDocumentUpdatedRef.current = onDocumentUpdated;

  const documentId = state.mode === "editing" ? state.documentId : null;

  const templates = useMemo(() => {
    if (state.mode !== "pick-template") return [];
    return sortTemplatesForView(overviewTemplates, state.viewType);
  }, [overviewTemplates, state]);

  const persist = useCallback(
    async (
      patch: {
        title?: string;
        content?: Record<string, unknown>;
        content_plain?: string;
        metadata?: Record<string, unknown>;
      },
      options?: { notifyBoard?: boolean },
    ) => {
      if (!documentId || !canWriteActiveScope) return;
      setSaveError(null);
      try {
        const response = await fetch(`/app/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            typeof data.error === "string" ? data.error : "Couldn't save",
          );
        }
        if (options?.notifyBoard) onDocumentUpdatedRef.current?.();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Couldn't save");
      }
    },
    [documentId, canWriteActiveScope],
  );

  const scheduleContentSave = useCallback(
    (nextContent: Record<string, unknown>, plainText: string) => {
      // Keep TipTap as source of truth — do not push content back into React
      // state (that re-triggered contentSync and caused flicker).
      contentRef.current = nextContent;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist({ content: nextContent, content_plain: plainText });
      }, 800);
    },
    [persist],
  );

  const handleTitleChange = useCallback(
    (next: string) => {
      setTitle(next);
      if (titleTimer.current) clearTimeout(titleTimer.current);
      titleTimer.current = setTimeout(() => {
        void persist(
          { title: next.trim() || "Untitled Document" },
          { notifyBoard: true },
        );
      }, 500);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (state.mode !== "editing" || !state.documentId) {
      loadedDocIdRef.current = null;
      setEditorReady(false);
      return;
    }

    const docId = state.documentId;
    // Same document already in the panel — parent board refresh must not reload.
    if (loadedDocIdRef.current === docId) {
      return;
    }

    let cancelled = false;
    setLoadingDoc(true);
    setEditorReady(false);
    setPropertiesOpen(false);
    setPropertiesStage("view");
    void (async () => {
      try {
        const response = await fetch(`/app/api/documents/${docId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Couldn't load document",
          );
        }
        if (cancelled) return;
        const doc = data.document as {
          title?: string;
          content?: Record<string, unknown> | null;
          metadata?: Record<string, unknown> | null;
        };
        const nextContent =
          (doc.content as Record<string, unknown>) ??
          (EMPTY_DOCUMENT_CONTENT as Record<string, unknown>);
        setTitle(doc.title?.trim() || "Untitled Document");
        setContent(nextContent);
        contentRef.current = nextContent;
        setMetadata(doc.metadata ?? {});
        loadedDocIdRef.current = docId;
        setEditorReady(true);
      } catch (err) {
        if (!cancelled) {
          showToastRef.current(
            err instanceof Error ? err.message : "Couldn't load document",
            "error",
          );
          onCloseRef.current();
        }
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.mode, state.mode === "editing" ? state.documentId : null]);

  const handlePickTemplate = async (template: TemplateRecord) => {
    if (state.mode !== "pick-template" || !workspaceId) return;
    if (!canWriteActiveScope) {
      showToast("You have read-only access in this scope", "error");
      return;
    }
    setCreating(true);
    try {
      let seedMetadata: Record<string, unknown> = {};
      const ctx = state.createContext;
      if (ctx?.kind === "seed" && ctx.metadata) {
        seedMetadata = { ...ctx.metadata };
      }
      if (ctx?.kind === "child") {
        seedMetadata = withUserMetadataValue(seedMetadata, "origin", {
          document_id: ctx.parentDocId,
          title: ctx.parentTitle ?? "Untitled",
        }) as Record<string, unknown>;
      }

      const created = await createDocument({
        title: "Untitled Document",
        template_id: template.id,
        metadata:
          Object.keys(seedMetadata).length > 0 ? seedMetadata : undefined,
      });
      if (!created) {
        showToast("Couldn't create document", "error");
        return;
      }
      onDocumentCreated({ id: created.id, title: created.title });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't create document",
        "error",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleMetadataFieldChange = (
    fieldKey: string,
    value: MetadataFieldValue,
  ) => {
    const next = withUserMetadataValue(
      metadata,
      fieldKey,
      value,
    ) as Record<string, unknown>;
    setMetadata(next);
    void persist({ metadata: next }, { notifyBoard: true });
  };

  const handleMetadataGroupInstancesChange = (
    nextMetadata: Record<string, unknown>,
  ) => {
    setMetadata(nextMetadata);
    void persist({ metadata: nextMetadata }, { notifyBoard: true });
  };

  if (state.mode === "closed") return null;

  if (state.mode === "pick-template") {
    return (
      <aside className="view-document-panel view-document-panel--picker">
        <header className="view-document-panel__chrome">
          <h3 className="view-document-panel__picker-title">New document</h3>
          <IconButton icon={X} label="Close panel" size="small" onClick={onClose} />
        </header>
        <p className="caption view-document-panel__intro">
          Choose a template for this entry. Suggested templates for this view
          appear first.
        </p>
        {creating ? (
          <LoaderState label="Creating…" size="s" align="fill" />
        ) : templates.length === 0 ? (
          <p className="caption">No templates available in this scope yet.</p>
        ) : (
          <ul className="view-document-panel__templates overlay-scrollbar">
            {templates.map((template) => {
              const slug = slugForTemplate(template);
              const suggested =
                slug != null &&
                getRecommendedTemplatesForView(state.viewType).includes(slug);
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    className="view-document-panel__template"
                    onClick={() => void handlePickTemplate(template)}
                  >
                    <span className="view-document-panel__template-name">
                      {template.name}
                    </span>
                    {suggested ? (
                      <span className="caption view-document-panel__suggested">
                        Suggested
                      </span>
                    ) : null}
                    {template.description ? (
                      <span className="caption view-document-panel__template-desc">
                        {template.description}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    );
  }

  return (
    <aside
      className={`view-document-panel view-document-panel--editor${
        propertiesOpen ? " view-document-panel--properties-open" : ""
      }`}
    >
      <header className="view-document-panel__chrome">
        <div className="view-document-panel__chrome-actions">
          <IconButton
            icon={ExternalLink}
            label="Open full page"
            size="small"
            onClick={() => onOpenFullPage(state.documentId, title)}
          />
          <IconButton icon={X} label="Close panel" size="small" onClick={onClose} />
        </div>
      </header>

      {saveError ? (
        <p className="caption view-document-panel__error">{saveError}</p>
      ) : null}

      {loadingDoc || !editorReady ? (
        <LoaderState label="Loading document…" align="fill" />
      ) : (
        <div className="view-document-panel__body">
          <div className="view-document-panel__editor-pane overlay-scrollbar">
            <article className="view-document-panel__article">
              <header className="editor-content__header">
                <div className="editor-content__gutter" aria-hidden="true" />
                <div className="editor-content__main">
                  <EditorTitleField
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="Untitled Document"
                    aria-label="Document title"
                    disabled={!canWriteActiveScope}
                  />
                  <div className="editor-content__meta">
                    <div className="editor-content__meta-row">
                      <IconLabelButton
                        variant="meta"
                        icon={SlidersHorizontal}
                        active={propertiesOpen}
                        disabled={!online}
                        title={
                          online
                            ? undefined
                            : "Properties unavailable offline — you can still write"
                        }
                        onClick={() => setPropertiesOpen((open) => !open)}
                      >
                        Properties
                      </IconLabelButton>
                    </div>
                  </div>
                </div>
                <div className="editor-content__gutter" aria-hidden="true" />
              </header>
              <div className="view-document-panel__tiptap">
                <div className="editor-content__body">
                  <div className="editor-content__gutter" aria-hidden="true" />
                  <div className="editor-content__main editor-content__main--body">
                    <TipTapEditor
                      key={state.documentId}
                      content={content}
                      contentSyncToken={0}
                      editable={canWriteActiveScope}
                      documentId={state.documentId}
                      workspaceId={workspaceId}
                      onUpdate={scheduleContentSave}
                    />
                  </div>
                  <div className="editor-content__gutter" aria-hidden="true" />
                </div>
              </div>
            </article>
          </div>

          {propertiesOpen ? (
            <aside className="view-document-panel__properties">
              <PropertiesTab
                mode="document"
                stage={propertiesStage}
                onStageChange={setPropertiesStage}
                metadata={metadata}
                metadataSchemas={schemas}
                metadataGroups={groups}
                metadataSchemasLoading={schemasLoading}
                createMetadataSchema={createSchema}
                createMetadataGroup={createGroup}
                updateMetadataSchema={updateSchema}
                updateMetadataGroup={updateGroup}
                deleteMetadataSchema={deleteSchema}
                deleteMetadataGroup={deleteGroup}
                onMetadataFieldChange={handleMetadataFieldChange}
                onMetadataGroupInstancesChange={handleMetadataGroupInstancesChange}
                documentId={state.documentId}
              />
            </aside>
          ) : null}
        </div>
      )}
    </aside>
  );
}
