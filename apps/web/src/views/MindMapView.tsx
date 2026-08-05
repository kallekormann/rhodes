"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnReconnect,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyMindMapLayout,
  RELATION_VIEW_FIELD_TYPES,
  type MindMapLayout,
} from "@rhodes/shared/view-engine";
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
  addMindMapChildNode,
  bindDocumentToMindMapNode,
  collectSubtreeNodeIds,
  mindMapConfigFromInstance,
  mindMapLayout,
  mindMapNeedsGuidedSetup,
  reparentMindMapNode,
  removeMindMapNodes,
  resolveMindMapNodeSide,
  resolveMindMapRelationField,
  resolveMindMapReparentFromConnect,
  resolveMindMapReparentFromReconnect,
} from "@/lib/views/mindmap";
import {
  layoutMindMapTree,
  mindMapHandleForSide,
  sideFromHandleId,
} from "@/lib/views/mindmap-layout";
import type { MindMapSide } from "@rhodes/shared/view-engine";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import {
  MIND_MAP_NODE_TYPES,
  type MindMapNodeData,
} from "@/components/mindmap/MindMapNode";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { Dialog } from "@/components/Dialog";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import { ViewDocumentPanelHost } from "@/components/views/ViewDocumentPanelHost";
import type {
  ViewDocumentCreateContext,
  ViewDocumentPanelState,
} from "@/components/views/view-document-panel-types";
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

/** Matches `.view-document-panel` width: min(100%, max(50vw, 420px)). */
function estimatePanelInset(canvasWidth: number): number {
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : canvasWidth;
  return Math.min(canvasWidth, Math.max(viewportWidth * 0.5, 420));
}

/**
 * When the document panel opens, pan so the selected node sits in the left
 * uncovered strip instead of under the sidebar.
 */
function MindMapFrameSelection({
  nodeId,
  panelOpen,
}: {
  nodeId: string | null;
  panelOpen: boolean;
}) {
  const { getNode, setCenter, getViewport } = useReactFlow();

  useEffect(() => {
    if (!nodeId || !panelOpen) return;

    const timer = window.setTimeout(() => {
      const node = getNode(nodeId);
      if (!node) return;

      const width = node.measured?.width ?? node.width ?? 200;
      const height = node.measured?.height ?? node.height ?? 72;
      const centerX = node.position.x + width / 2;
      const centerY = node.position.y + height / 2;

      const canvas = document.querySelector(
        ".mindmap-view__canvas",
      ) as HTMLElement | null;
      const canvasWidth = canvas?.clientWidth ?? 800;
      const inset = estimatePanelInset(canvasWidth);
      const { zoom } = getViewport();
      const offsetFlowX = inset > 0 ? inset / 2 / Math.max(zoom, 0.01) : 0;

      setCenter(centerX + offsetFlowX, centerY, {
        zoom,
        duration: 420,
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [nodeId, panelOpen, getNode, setCenter, getViewport]);

  return null;
}

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
        hint="Parent links also write Origin; this field is used for extra connections when set."
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
            Origin is used by default. Add another Linked document property if needed.
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
  const {
    documents,
    loading,
    error,
    updateDocument,
    deleteDocument,
    refresh,
  } = useDocuments(workspaceId, "all", session.userId);
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

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [docPanel, setDocPanel] = useState<ViewDocumentPanelState>({
    mode: "closed",
  });
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>(
    {},
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    nodeId: string;
    title: string;
    documentIds: string[];
  } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  /** Optimistic layout while a server write is in flight (add child, etc.). */
  const [layoutOverride, setLayoutOverride] = useState<MindMapLayout | null>(
    null,
  );
  const guidedOpenedForInstance = useRef<string | null>(null);
  const layoutWriteChain = useRef(Promise.resolve<void>(undefined));

  const config = useMemo(() => mindMapConfigFromInstance(instance), [instance]);
  const instanceLayout = useMemo(() => mindMapLayout(instance), [instance]);
  const layout = layoutOverride ?? instanceLayout;
  const layoutRef = useRef(layout);
  const instanceRef = useRef(instance);
  layoutRef.current = layout;
  instanceRef.current = instance;

  // Drop the override once the server instance catches up.
  useEffect(() => {
    if (!layoutOverride) return;
    const overrideIds = Object.keys(layoutOverride.nodes);
    const caughtUp = overrideIds.every((id) => {
      const local = layoutOverride.nodes[id];
      const remote = instanceLayout.nodes[id];
      return (
        remote != null &&
        remote.documentId === local?.documentId &&
        remote.parentId === local?.parentId
      );
    });
    if (caughtUp && overrideIds.length <= Object.keys(instanceLayout.nodes).length) {
      setLayoutOverride(null);
    }
  }, [instanceLayout, layoutOverride]);

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
    setSelectedNodeId(null);
    setTitleOverrides({});
    setDeleteTarget(null);
    setLayoutOverride(null);
    guidedOpenedForInstance.current = null;
  }, [workspaceId, activeInstanceId]);

  const pageTitle = instance?.label ?? "Mind-Map";

  const persistLayout = useCallback(
    (nextLayout: MindMapLayout, options?: { isSeed?: boolean }) => {
      const run = async () => {
        const current = instanceRef.current;
        if (options?.isSeed) {
          const raw = current?.layout;
          if (
            raw != null &&
            typeof raw === "object" &&
            !Array.isArray(raw) &&
            Object.keys(raw).length > 0
          ) {
            // A real layout landed while this seed was queued — don't clobber it.
            return;
          }
        }

        if (current) {
          const result = await updateInstance(current.id, {
            layout: nextLayout,
          });
          if (!result.ok) {
            showToast(result.error, "error");
          }
          return;
        }

        const result = await createInstance({
          base_view_type: "mindmap",
          label: "Mind-Map",
          config: {},
          layout: nextLayout,
        });
        if (!result.ok) {
          showToast(result.error, "error");
        }
      };

      const queued = layoutWriteChain.current.then(run, run);
      layoutWriteChain.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },
    [updateInstance, createInstance, showToast],
  );

  // Ensure empty / missing layouts get a placeholder root.
  useEffect(() => {
    if (instancesLoading || scopesPending) return;
    if (!workspaceId || !instance) return;
    const raw = instance.layout;
    const needsSeed =
      raw == null ||
      (typeof raw === "object" &&
        !Array.isArray(raw) &&
        Object.keys(raw).length === 0);
    if (!needsSeed) return;
    void persistLayout(createEmptyMindMapLayout(), { isSeed: true });
  }, [
    instance,
    instancesLoading,
    scopesPending,
    workspaceId,
    persistLayout,
  ]);

  // Guided setup: open template picker on unfinished root.
  useEffect(() => {
    if (!canWriteActiveScope || mapStillLoading()) return;
    if (!instance) return;
    if (!mindMapNeedsGuidedSetup(layout)) return;
    const key = instance.id;
    if (guidedOpenedForInstance.current === key) return;
    guidedOpenedForInstance.current = key;
    setSelectedNodeId(layout.rootId);
    setPanel(null);
    setDocPanel({
      mode: "pick-template",
      viewType: "mindmap",
      createContext: { kind: "root", bindNodeId: layout.rootId },
    });

    function mapStillLoading() {
      return scopesPending || loading || schemasLoading || instancesLoading;
    }
  }, [
    canWriteActiveScope,
    instance,
    layout,
    scopesPending,
    loading,
    schemasLoading,
    instancesLoading,
  ]);

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

  const writeParentLink = useCallback(
    async (parentDocId: string, child: { id: string; title: string }) => {
      const parent = docsById.get(parentDocId);
      const childDoc = docsById.get(child.id);
      const originMeta = withUserMetadataValue(
        childDoc?.metadata ?? null,
        "origin",
        {
          document_id: parentDocId,
          title: parent?.title || "Untitled",
        },
      );
      await updateDocument(child.id, { metadata: originMeta });

      if (parent && relationField && relationField.field_key !== "origin") {
        const nextParentMeta = withUserMetadataValue(
          parent.metadata,
          relationField.field_key,
          { document_id: child.id, title: child.title || "Untitled" },
        );
        await updateDocument(parentDocId, { metadata: nextParentMeta });
      }
    },
    [docsById, relationField, updateDocument],
  );

  const openNode = useCallback(
    (nodeId: string) => {
      const entry = layout.nodes[nodeId];
      if (!entry) return;
      setSelectedNodeId(nodeId);
      setPanel(null);
      if (!entry.documentId) {
        if (!canWriteActiveScope) return;
        setDocPanel({
          mode: "pick-template",
          viewType: "mindmap",
          createContext: { kind: "root", bindNodeId: nodeId },
        });
        return;
      }
      setDocPanel({ mode: "editing", documentId: entry.documentId });
    },
    [layout.nodes, canWriteActiveScope],
  );

  const handleAddChild = useCallback(
    (parentNodeId: string) => {
      if (!canWriteActiveScope) return;
      const parent = layout.nodes[parentNodeId];
      if (!parent?.documentId) {
        showToast("Finish setting up this topic before adding children", "info");
        openNode(parentNodeId);
        return;
      }
      const parentDoc = docsById.get(parent.documentId);
      setSelectedNodeId(parentNodeId);
      setPanel(null);
      setDocPanel({
        mode: "pick-template",
        viewType: "mindmap",
        createContext: {
          kind: "child",
          parentDocId: parent.documentId,
          parentTitle:
            parentDoc?.title ||
            titleOverrides[parent.documentId] ||
            "Untitled",
          parentNodeId,
        },
      });
    },
    [
      canWriteActiveScope,
      layout.nodes,
      showToast,
      openNode,
      docsById,
      titleOverrides,
    ],
  );

  const requestDeleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === layout.rootId && !layout.nodes[nodeId]?.documentId) return;
      const subtree = collectSubtreeNodeIds(layout, nodeId);
      const documentIds = subtree
        .map((id) => layout.nodes[id]?.documentId)
        .filter((id): id is string => Boolean(id));
      const title =
        (layout.nodes[nodeId]?.documentId &&
          docsById.get(layout.nodes[nodeId]!.documentId!)?.title) ||
        titleOverrides[nodeId] ||
        "this topic";
      setDeleteTarget({ nodeId, title, documentIds });
    },
    [layout, docsById, titleOverrides],
  );

  const confirmDeleteNode = useCallback(async () => {
    if (!deleteTarget) return;
    const { nodeId, documentIds } = deleteTarget;
    for (const docId of documentIds) {
      const ok = await deleteDocument(docId);
      if (!ok) {
        showToast("Couldn't delete document", "error");
        return;
      }
    }
    const subtree = collectSubtreeNodeIds(layout, nodeId);
    const pruned = removeMindMapNodes(layout, subtree);
    const next =
      Object.keys(pruned.nodes).length === 0
        ? createEmptyMindMapLayout()
        : layoutMindMapTree(pruned);
    await persistLayout(next);
    setDeleteTarget(null);
    setSelectedNodeId(null);
    setDocPanel({ mode: "closed" });
    void refresh();
  }, [
    deleteTarget,
    deleteDocument,
    showToast,
    layout,
    persistLayout,
    refresh,
  ]);

  const handlersRef = useRef({
    openNode,
    handleAddChild,
    requestDeleteNode,
  });
  handlersRef.current = { openNode, handleAddChild, requestDeleteNode };

  const flowNodes = useMemo<Node[]>(() => {
    return Object.entries(layout.nodes).map(([id, entry]) => {
      const doc = entry.documentId ? docsById.get(entry.documentId) : null;
      const title =
        titleOverrides[entry.documentId ?? id] ??
        doc?.title ??
        (entry.documentId ? "Untitled" : "Central topic");
      const isRoot = id === layout.rootId;
      const side = isRoot
        ? null
        : entry.side === "left" || entry.side === "right"
          ? entry.side
          : resolveMindMapNodeSide(layout, id);
      const data: MindMapNodeData = {
        title,
        placeholder: !entry.documentId,
        isRoot,
        side,
        canAddChild: canWriteActiveScope && Boolean(entry.documentId),
        canDelete: canWriteActiveScope && Boolean(entry.documentId),
        onOpen: (nodeId) => handlersRef.current.openNode(nodeId),
        onAddChild: (nodeId) => void handlersRef.current.handleAddChild(nodeId),
        onDelete: (nodeId) => handlersRef.current.requestDeleteNode(nodeId),
      };
      return {
        id,
        type: "mindmap",
        position: { x: entry.x, y: entry.y },
        selected: selectedNodeId === id,
        data,
      };
    });
  }, [
    layout,
    docsById,
    titleOverrides,
    canWriteActiveScope,
    selectedNodeId,
  ]);

  const flowEdges = useMemo<Edge[]>(() => {
    const edges: Edge[] = [];
    for (const [id, entry] of Object.entries(layout.nodes)) {
      if (!entry.parentId || !layout.nodes[entry.parentId]) continue;
      const side =
        entry.side === "left" || entry.side === "right"
          ? entry.side
          : resolveMindMapNodeSide(layout, id);
      edges.push({
        id: `${entry.parentId}->${id}`,
        source: entry.parentId,
        target: id,
        // Same handle id on both ends: Loose mode treats each circle as
        // bidirectional, so one connector per side is enough.
        sourceHandle: mindMapHandleForSide(side),
        targetHandle: mindMapHandleForSide(side === "left" ? "right" : "left"),
        type: "smoothstep",
        style: { stroke: "var(--color-border-strong, var(--color-border))" },
      });
    }
    return edges;
  }, [layout]);

  const applyReparent = useCallback(
    async (
      childId: string,
      parentId: string,
      side: MindMapSide | null | undefined,
    ) => {
      if (!canWriteActiveScope) return;
      if (childId === parentId) return;
      if (childId === layout.rootId) return;
      const next = layoutMindMapTree(
        reparentMindMapNode(layout, childId, parentId, side),
      );
      await persistLayout(next);
      const parentDoc = layout.nodes[parentId]?.documentId;
      const childDoc = next.nodes[childId]?.documentId;
      if (parentDoc && childDoc) {
        const child = docsById.get(childDoc);
        if (child) {
          await writeParentLink(parentDoc, {
            id: child.id,
            title: child.title,
          });
        }
      }
    },
    [canWriteActiveScope, layout, persistLayout, docsById, writeParentLink],
  );

  const resolveConnectionSide = useCallback(
    (connection: Connection, parentId: string): MindMapSide | undefined => {
      const fromSource = sideFromHandleId(connection.sourceHandle);
      const fromTarget = sideFromHandleId(connection.targetHandle);
      if (parentId === layout.rootId) {
        return fromSource ?? fromTarget ?? undefined;
      }
      return resolveMindMapNodeSide(layout, parentId);
    },
    [layout],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);
  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      const existing = layout.nodes[node.id];
      if (!existing) return;
      void persistLayout({
        ...layout,
        nodes: {
          ...layout.nodes,
          [node.id]: {
            ...existing,
            x: node.position.x,
            y: node.position.y,
          },
        },
      });
    },
    [layout, persistLayout],
  );

  const handleReconnect: OnReconnect = useCallback(
    async (oldEdge, newConnection) => {
      if (!canWriteActiveScope) return;
      const endpoints = resolveMindMapReparentFromReconnect(
        layoutRef.current,
        { source: oldEdge.source, target: oldEdge.target },
        {
          source: newConnection.source,
          target: newConnection.target,
        },
      );
      if (!endpoints) return;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
      await applyReparent(
        endpoints.childId,
        endpoints.parentId,
        resolveConnectionSide(newConnection, endpoints.parentId),
      );
    },
    [canWriteActiveScope, setEdges, applyReparent, resolveConnectionSide],
  );

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!canWriteActiveScope) return;
      if (!connection.source || !connection.target) return;
      const endpoints = resolveMindMapReparentFromConnect(
        layoutRef.current,
        connection.source,
        connection.target,
      );
      if (!endpoints) return;
      await applyReparent(
        endpoints.childId,
        endpoints.parentId,
        resolveConnectionSide(connection, endpoints.parentId),
      );
    },
    [canWriteActiveScope, applyReparent, resolveConnectionSide],
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

  const handleDocumentCreated = useCallback(
    async (
      doc: { id: string; title: string },
      createContext?: ViewDocumentCreateContext,
    ) => {
      const latest = layoutRef.current;

      if (createContext?.kind === "child") {
        const parentNodeId =
          createContext.parentNodeId ??
          Object.entries(latest.nodes).find(
            ([, node]) => node.documentId === createContext.parentDocId,
          )?.[0] ??
          null;
        const parentEntry = parentNodeId ? latest.nodes[parentNodeId] : undefined;
        if (!parentNodeId || !parentEntry?.documentId) {
          setDocPanel({ mode: "editing", documentId: doc.id });
          return;
        }

        const seeded = addMindMapChildNode(
          latest,
          parentNodeId,
          doc.id,
          { x: parentEntry.x + 220, y: parentEntry.y + 40 },
          doc.id,
        );
        const next = layoutMindMapTree(seeded);
        setLayoutOverride(next);
        setSelectedNodeId(doc.id);
        setTitleOverrides((prev) => ({ ...prev, [doc.id]: doc.title }));
        setDocPanel({ mode: "editing", documentId: doc.id });

        void (async () => {
          await persistLayout(next);
          if (relationField && relationField.field_key !== "origin") {
            const parentDoc = docsById.get(parentEntry.documentId!);
            if (parentDoc) {
              const nextParentMeta = withUserMetadataValue(
                parentDoc.metadata,
                relationField.field_key,
                { document_id: doc.id, title: doc.title || "Untitled" },
              );
              await updateDocument(parentEntry.documentId!, {
                metadata: nextParentMeta,
              });
            }
          }
        })();
        return;
      }

      const bindId =
        (createContext?.kind === "root" && createContext.bindNodeId) ||
        selectedNodeId ||
        (latest.nodes[latest.rootId] && !latest.nodes[latest.rootId]?.documentId
          ? latest.rootId
          : null) ||
        Object.entries(latest.nodes).find(([, node]) => !node.documentId)?.[0] ||
        null;

      const entry = bindId ? latest.nodes[bindId] : undefined;
      if (bindId && entry && !entry.documentId) {
        const bound = bindDocumentToMindMapNode(latest, bindId, doc.id);
        setLayoutOverride(bound);
        setSelectedNodeId(bound.nodes[doc.id] ? doc.id : bound.rootId);
        setTitleOverrides((prev) => ({ ...prev, [doc.id]: doc.title }));
        setDocPanel({ mode: "editing", documentId: doc.id });
        void persistLayout(bound);
        return;
      }

      setDocPanel({ mode: "editing", documentId: doc.id });
    },
    [
      selectedNodeId,
      persistLayout,
      relationField,
      docsById,
      updateDocument,
    ],
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    openNode(node.id);
  }, [openNode]);

  const mapLoading = scopesPending || loading || schemasLoading || instancesLoading;
  const help = VIEW_HELP_CONTENT.mindmap;
  const infoWarnings = [
    ...(mindMapNeedsGuidedSetup(layout)
      ? ["Choose a template for the central topic to start building the map."]
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
          onCreate={(label) => {
            void createTab(label).then(() => {
              guidedOpenedForInstance.current = null;
            });
          }}
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
            />
          }
        />

        {instancesError ? (
          <p className="caption mindmap-view__error">{instancesError}</p>
        ) : null}
        {error ? <p className="caption mindmap-view__error">{error}</p> : null}

        {mapLoading ? (
          <LoaderState label="Loading mind-map…" align="fill" />
        ) : (
          <div className="mindmap-view__canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={MIND_MAP_NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={handleNodeDragStop}
              onNodeClick={handleNodeClick}
              onConnect={(connection) => void handleConnect(connection)}
              onReconnect={(oldEdge, connection) =>
                void handleReconnect(oldEdge, connection)
              }
              nodesConnectable={canWriteActiveScope}
              nodesDraggable={canWriteActiveScope}
              edgesReconnectable={canWriteActiveScope}
              connectionMode={ConnectionMode.Loose}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <MindMapFrameSelection
                nodeId={selectedNodeId}
                panelOpen={docPanel.mode !== "closed"}
              />
              <Background gap={20} color="var(--color-border-subtle, var(--color-border))" />
              <Controls />
            </ReactFlow>
          </div>
        )}

        {panel === "settings" ? (
          <MindMapSettingsPanel
            title={pageTitle}
            subtitle={config.subtitle ?? ""}
            relationFieldKey={config.relationField ?? relationField?.field_key ?? ""}
            relationFieldOptions={relationFieldOptions}
            onClose={() => setPanel(null)}
            onSave={(input) => void saveSettings(input)}
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
          onClose={() => {
            setDocPanel({ mode: "closed" });
            setSelectedNodeId(null);
          }}
          onOpenFullPage={openFullPage}
          onDocumentCreated={(doc, createContext) => {
            void handleDocumentCreated(doc, createContext);
          }}
          onDocumentUpdated={() => {
            void refresh();
          }}
          onDocumentTitleChange={(documentId, title) => {
            setTitleOverrides((prev) => ({ ...prev, [documentId]: title }));
          }}
        />

        <Dialog
          open={deleteTarget != null}
          title="Delete topic?"
          description={
            deleteTarget
              ? deleteTarget.documentIds.length > 1
                ? `“${deleteTarget.title}” and ${deleteTarget.documentIds.length - 1} related topic${deleteTarget.documentIds.length - 1 === 1 ? "" : "s"} will be permanently deleted.`
                : `“${deleteTarget.title}” will be permanently deleted. This cannot be undone.`
              : ""
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          onConfirm={() => void confirmDeleteNode()}
          onClose={() => setDeleteTarget(null)}
        />
      </div>
    </DocumentsSyncGate>
  );
}
