"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import { ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RELATION_VIEW_FIELD_TYPES } from "@rhodes/shared/view-engine";
import { useApp } from "@/context/AppContext";
import type { DocumentRecord } from "@/hooks/useDocument";
import { useDocuments } from "@/hooks/useDocuments";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import { useViewInstances } from "@/hooks/useViewInstances";
import { usePublishScopeInstanceLabel } from "@/hooks/usePublishScopeInstanceLabel";
import { cacheDocumentTitle } from "@/lib/editor/editor-shell-session";
import { isDocumentArchived } from "@/lib/documents/metadata";
import { isDocumentNativeToScope } from "@/lib/documents/share-context";
import { withUserMetadataValue } from "@/lib/metadata/schemas";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";
import {
  mindMapConfigFromInstance,
  mindMapLayout,
  nextNodePosition,
  resolveMindMapRelationField,
} from "@/lib/views/mindmap";
import { buildRelationEdges, relationFields } from "@/lib/views/relation-graph";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import { GRAPH_NODE_TYPES } from "@/components/graph/DocumentNode";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import { NavLink } from "@/components/NavLink";
import { ViewDocumentPanelHost } from "@/components/views/ViewDocumentPanelHost";
import type { ViewDocumentPanelState } from "@/components/views/view-document-panel-types";
import {
  ViewDockPanel,
  ViewSettingsField,
} from "@/components/views/ViewDockPanel";
import {
  ViewHeaderActions,
  type ViewPanelMode,
} from "@/components/views/ViewHeaderActions";
import { ViewInfoPanel } from "@/components/views/ViewInfoPanel";
import { ViewInstanceTabBar } from "@/components/views/ViewInstanceTabBar";
import "./MindMapView.css";

function MindMapSettingsPanel({
  title,
  subtitle,
  relationFieldKey,
  relationFieldOptions,
  onClose,
  onSave,
  saving,
}: {
  title: string;
  subtitle: string;
  relationFieldKey: string;
  relationFieldOptions: MetadataSchemaField[];
  onClose: () => void;
  onSave: (input: {
    title: string;
    subtitle: string;
    relationFieldKey: string;
  }) => void;
  saving: boolean;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const [draftRelation, setDraftRelation] = useState(relationFieldKey);
  const canSave = draftTitle.trim().length > 0;

  return (
    <ViewDockPanel
      title="Mind-Map settings"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="view-dock-panel__button"
          disabled={!canSave || saving}
          onClick={() =>
            onSave({
              title: draftTitle.trim(),
              subtitle: draftSubtitle.trim(),
              relationFieldKey: draftRelation,
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <ViewSettingsField label="Title">
        <Input value={draftTitle} onChange={setDraftTitle} placeholder="Mind-Map title" />
      </ViewSettingsField>
      <ViewSettingsField label="Subtitle">
        <Input
          value={draftSubtitle}
          onChange={setDraftSubtitle}
          placeholder="Optional subtitle"
        />
      </ViewSettingsField>
      <ViewSettingsField
        label="Relation field"
        hint="New connections write to this Linked document property."
      >
        {relationFieldOptions.length > 0 ? (
          <Dropdown
            variant="field"
            options={relationFieldOptions.map((field) => ({
              id: field.field_key,
              label: field.field_label,
            }))}
            value={draftRelation}
            onChange={setDraftRelation}
            placeholder="Choose a property…"
            aria-label="Relation field"
          />
        ) : (
          <p className="caption view-settings-field__hint">
            Add a Linked document property before connecting nodes.
          </p>
        )}
      </ViewSettingsField>
    </ViewDockPanel>
  );
}

export function MindMapView() {
  const {
    workspaceId,
    canWriteActiveScope,
    showToast,
    openEditor,
    setDocumentTitle,
    setDocumentId,
    session,
  } = useApp();

  const scopesPending = !workspaceId;
  const { documents, loading, error, updateDocument, refresh } = useDocuments(
    workspaceId,
    "all",
    session.userId,
  );
  const { schemas, loading: schemasLoading } = useMetadataSchemas(workspaceId);
  const {
    instances,
    activeInstance: instance,
    activeId: activeInstanceId,
    setActiveId: setActiveInstanceId,
    loading: instancesLoading,
    error: instancesError,
    updateInstance,
    createInstance,
    createTab,
    deleteTab,
  } = useViewInstances(workspaceId, "mindmap", {
    canWrite: canWriteActiveScope,
    onError: (message) => showToast(message, "error"),
  });

  usePublishScopeInstanceLabel(instance?.label);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [docPanel, setDocPanel] = useState<ViewDocumentPanelState>({
    mode: "closed",
  });
  const [pendingPlacement, setPendingPlacement] = useState<{
    parentDocId?: string;
  } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const config = useMemo(() => mindMapConfigFromInstance(instance), [instance]);
  const layout = useMemo(() => mindMapLayout(instance), [instance]);
  const relationField = useMemo(
    () => resolveMindMapRelationField(schemas, config),
    [schemas, config],
  );
  const relationFieldOptions = useMemo(
    () =>
      schemas.filter((schema) =>
        (RELATION_VIEW_FIELD_TYPES as readonly string[]).includes(schema.field_type),
      ),
    [schemas],
  );

  useEffect(() => {
    setPanel(null);
    setDocPanel({ mode: "closed" });
    setSelectedDocId(null);
    setAddPickerOpen(false);
    setPendingPlacement(null);
  }, [workspaceId, activeInstanceId]);

  const pageTitle = instance?.label ?? "Mind-Map";

  const saveSettings = async (input: {
    title: string;
    subtitle: string;
    relationFieldKey: string;
  }) => {
    setSavingSettings(true);
    const nextConfig = {
      ...config,
      ...(input.relationFieldKey ? { relationField: input.relationFieldKey } : {}),
      ...(input.subtitle ? { subtitle: input.subtitle } : { subtitle: undefined }),
    };
    const result = instance
      ? await updateInstance(instance.id, { label: input.title, config: nextConfig })
      : await createInstance({
          base_view_type: "mindmap",
          label: input.title,
          config: nextConfig,
          layout,
        });
    setSavingSettings(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setPanel(null);
  };

  const activeDocs = useMemo(
    () =>
      documents.filter(
        (doc) =>
          !isDocumentArchived(doc.metadata) &&
          isDocumentNativeToScope(doc, workspaceId),
      ),
    [documents, workspaceId],
  );
  const docsById = useMemo(() => {
    const map = new Map<string, DocumentRecord>();
    for (const doc of activeDocs) map.set(doc.id, doc);
    return map;
  }, [activeDocs]);

  const canvasDocs = useMemo(
    () =>
      Object.keys(layout)
        .map((id) => docsById.get(id))
        .filter((doc): doc is DocumentRecord => Boolean(doc)),
    [layout, docsById],
  );

  const initialNodes = useMemo<Node[]>(
    () =>
      canvasDocs.map((doc) => ({
        id: doc.id,
        type: "document",
        position: layout[doc.id] ?? { x: 0, y: 0 },
        data: { title: doc.title || "Untitled" },
      })),
    [canvasDocs, layout],
  );

  const initialEdges = useMemo<Edge[]>(() => {
    const fields = relationFields(schemas);
    const relationEdges = buildRelationEdges(canvasDocs, fields);
    return relationEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.fieldLabel,
    }));
  }, [canvasDocs, schemas]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const persistLayout = useCallback(
    async (nextLayout: Record<string, { x: number; y: number }>) => {
      if (instance) {
        await updateInstance(instance.id, { layout: nextLayout });
        return;
      }
      await createInstance({
        base_view_type: "mindmap",
        label: "Mind-Map",
        config: {},
        layout: nextLayout,
      });
    },
    [instance, updateInstance, createInstance],
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      void persistLayout({ ...layout, [node.id]: { x: node.position.x, y: node.position.y } });
    },
    [layout, persistLayout],
  );

  const handleAddNode = useCallback(
    (docId: string) => {
      const doc = docsById.get(docId);
      if (!doc) return;
      const position = nextNodePosition(layout);
      void persistLayout({ ...layout, [docId]: position });
      setAddPickerOpen(false);
    },
    [docsById, layout, persistLayout],
  );

  const handleRemoveNode = useCallback(
    (docId: string) => {
      const nextLayout = { ...layout };
      delete nextLayout[docId];
      void persistLayout(nextLayout);
      if (selectedDocId === docId) setSelectedDocId(null);
      setDocPanel((prev) =>
        prev.mode === "editing" && prev.documentId === docId
          ? { mode: "closed" }
          : prev,
      );
    },
    [layout, persistLayout, selectedDocId],
  );

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!canWriteActiveScope) {
        showToast("You have read-only access in this scope", "error");
        return;
      }
      if (!relationField) {
        showToast(
          "Add a Linked document property in Settings before connecting nodes",
          "error",
        );
        return;
      }
      const source = docsById.get(connection.source);
      const target = docsById.get(connection.target);
      if (!source || !target) return;

      const nextMetadata = withUserMetadataValue(source.metadata, relationField.field_key, {
        document_id: target.id,
        title: target.title || "Untitled",
      });
      const updated = await updateDocument(source.id, { metadata: nextMetadata });
      if (!updated) {
        showToast("Could not connect documents", "error");
      }
    },
    [canWriteActiveScope, showToast, relationField, docsById, updateDocument],
  );

  const openFullPage = (documentId: string, title?: string) => {
    if (title) {
      cacheDocumentTitle(documentId, title);
      setDocumentTitle(title);
    }
    setDocumentId(documentId);
    setDocPanel({ mode: "closed" });
    openEditor(documentId);
  };

  const startCreateRoot = () => {
    if (!canWriteActiveScope) return;
    setPanel(null);
    setAddPickerOpen(false);
    setPendingPlacement({});
    setDocPanel({
      mode: "pick-template",
      viewType: "mindmap",
      createContext: { kind: "root" },
    });
  };

  const startCreateChild = (parent: DocumentRecord) => {
    if (!canWriteActiveScope) return;
    setPanel(null);
    setAddPickerOpen(false);
    setPendingPlacement({ parentDocId: parent.id });
    setDocPanel({
      mode: "pick-template",
      viewType: "mindmap",
      createContext: {
        kind: "child",
        parentDocId: parent.id,
        parentTitle: parent.title || "Untitled",
      },
    });
  };

  const placeCreatedDocument = useCallback(
    async (docId: string, title: string) => {
      const parentId = pendingPlacement?.parentDocId;
      const parentPos = parentId ? layout[parentId] : null;
      const position = parentPos
        ? { x: parentPos.x + 220, y: parentPos.y + 40 }
        : nextNodePosition(layout);
      await persistLayout({ ...layout, [docId]: position });

      if (parentId && relationField && relationField.field_key !== "origin") {
        const parent = docsById.get(parentId);
        if (parent) {
          const nextMetadata = withUserMetadataValue(
            parent.metadata,
            relationField.field_key,
            { document_id: docId, title: title || "Untitled" },
          );
          await updateDocument(parentId, { metadata: nextMetadata });
        }
      }
      setPendingPlacement(null);
      setSelectedDocId(docId);
    },
    [
      pendingPlacement,
      layout,
      persistLayout,
      relationField,
      docsById,
      updateDocument,
    ],
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedDocId(node.id);
    setPanel(null);
    setDocPanel({ mode: "editing", documentId: node.id });
  }, []);

  const addableDocs = useMemo(
    () => activeDocs.filter((doc) => !(doc.id in layout)),
    [activeDocs, layout],
  );

  const selectedDoc = selectedDocId ? docsById.get(selectedDocId) ?? null : null;
  const mapLoading = scopesPending || loading || schemasLoading || instancesLoading;
  const help = VIEW_HELP_CONTENT.mindmap;
  const infoWarnings = [
    ...(!relationField
      ? ["Add a Linked document property, or connections can't be created yet."]
      : []),
    ...(activeDocs.length === 0
      ? ["This scope has no documents yet to place on the canvas."]
      : []),
  ];

  return (
    <DocumentsSyncGate>
      <div className="mindmap-view">
        <ViewInstanceTabBar
          className="mindmap-view__tabs"
          tabs={instances.map((entry) => ({
            id: entry.id,
            label: entry.label,
          }))}
          activeId={activeInstanceId}
          onSelect={setActiveInstanceId}
          onCreate={(label) => createTab(label)}
          onDelete={(id) => deleteTab(id)}
          canEdit={canWriteActiveScope}
          createTitle="New mind-map"
          deleteNoun="mind-map"
          trailing={
            <ViewHeaderActions
              panel={panel}
              onPanelChange={(next) => {
                setDocPanel({ mode: "closed" });
                setPanel(next);
              }}
              canEditSettings={canWriteActiveScope}
              extra={
                canWriteActiveScope ? (
                  <>
                    <NavLink size="small" onClick={startCreateRoot}>
                      New root
                    </NavLink>
                    {selectedDoc ? (
                      <NavLink
                        size="small"
                        onClick={() => startCreateChild(selectedDoc)}
                      >
                        New child
                      </NavLink>
                    ) : null}
                    <NavLink
                      size="small"
                      onClick={() => setAddPickerOpen((v) => !v)}
                    >
                      Place existing
                    </NavLink>
                  </>
                ) : null
              }
            />
          }
        />

        {addPickerOpen ? (
          <div className="mindmap-view__add-picker">
            <Dropdown
              variant="field"
              options={addableDocs.map((doc) => ({
                id: doc.id,
                label: doc.title || "Untitled",
              }))}
              placeholder="Choose a document to add…"
              searchable
              onChange={handleAddNode}
              aria-label="Add document to canvas"
            />
          </div>
        ) : null}

        {instancesError ? (
          <p className="caption mindmap-view__error">{instancesError}</p>
        ) : null}
        {error ? <p className="caption mindmap-view__error">{error}</p> : null}

        {mapLoading ? (
          <LoaderState label="Loading mind-map…" align="fill" />
        ) : (
          <div className="mindmap-view__canvas">
            {canvasDocs.length === 0 ? (
              <p className="caption mindmap-view__empty">
                {canWriteActiveScope
                  ? 'No nodes yet. Use "New root" to create a document on the canvas.'
                  : "This mind-map has no nodes yet."}
              </p>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={GRAPH_NODE_TYPES}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={handleNodeDragStop}
                onNodeClick={handleNodeClick}
                onConnect={(connection) => void handleConnect(connection)}
                nodesConnectable={canWriteActiveScope}
                nodesDraggable={canWriteActiveScope}
                fitView
              >
                <Background />
                <Controls />
              </ReactFlow>
            )}
          </div>
        )}

        {selectedDoc && panel === null && docPanel.mode === "closed" ? (
          <aside className="mindmap-side-panel overlay-scrollbar">
            <header className="mindmap-side-panel__header">
              <h3 className="mindmap-side-panel__title">
                {selectedDoc.title || "Untitled"}
              </h3>
              <button
                type="button"
                aria-label="Close panel"
                className="mindmap-side-panel__icon-button"
                onClick={() => setSelectedDocId(null)}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </header>
            <p className="caption mindmap-side-panel__excerpt">
              {selectedDoc.content_plain?.trim()
                ? selectedDoc.content_plain.slice(0, 280)
                : "No content yet."}
            </p>
            <div className="mindmap-side-panel__actions">
              <button
                type="button"
                className="mindmap-side-panel__button"
                onClick={() =>
                  setDocPanel({ mode: "editing", documentId: selectedDoc.id })
                }
              >
                Edit in panel
              </button>
              <button
                type="button"
                className="mindmap-side-panel__button"
                onClick={() =>
                  openFullPage(selectedDoc.id, selectedDoc.title)
                }
              >
                <ExternalLink size={14} strokeWidth={1.75} />
                Open full page
              </button>
              {canWriteActiveScope ? (
                <>
                  <button
                    type="button"
                    className="mindmap-side-panel__button mindmap-side-panel__button--ghost"
                    onClick={() => startCreateChild(selectedDoc)}
                  >
                    New child
                  </button>
                  <button
                    type="button"
                    className="mindmap-side-panel__button mindmap-side-panel__button--ghost"
                    onClick={() => handleRemoveNode(selectedDoc.id)}
                  >
                    Remove from canvas
                  </button>
                </>
              ) : null}
            </div>
          </aside>
        ) : null}

        {panel === "settings" ? (
          <MindMapSettingsPanel
            title={pageTitle}
            subtitle={config.subtitle ?? ""}
            relationFieldKey={relationField?.field_key ?? ""}
            relationFieldOptions={relationFieldOptions.filter(
              (field) => field.field_key !== "origin",
            )}
            onClose={() => setPanel(null)}
            onSave={(input) => {
              void saveSettings(input);
            }}
            saving={savingSettings}
          />
        ) : null}

        {panel === "info" ? (
          <ViewInfoPanel
            description={help.description}
            setupSteps={[...help.setupSteps]}
            actions={[...help.actions]}
            warnings={infoWarnings}
            onClose={() => setPanel(null)}
          />
        ) : null}

        <ViewDocumentPanelHost
          state={docPanel}
          onClose={() => setDocPanel({ mode: "closed" })}
          onOpenFullPage={openFullPage}
          onDocumentCreated={(doc) => {
            void (async () => {
              await placeCreatedDocument(doc.id, doc.title);
              await refresh();
              setDocPanel({ mode: "editing", documentId: doc.id });
            })();
          }}
          onDocumentUpdated={() => {
            void refresh();
          }}
        />
      </div>
    </DocumentsSyncGate>
  );
}
