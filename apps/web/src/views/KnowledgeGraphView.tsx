"use client";

import "@xyflow/react/dist/style.css";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { computeForceLayout } from "@/lib/views/force-layout";
import {
  degreeEmphasis,
  knowledgeGraphConfigFromInstance,
  showCommunitiesEnabled,
} from "@/lib/views/knowledge-graph";
import {
  buildRelationEdges,
  computeDegrees,
  detectCommunities,
  relationFields,
  type RelationEdge,
} from "@/lib/views/relation-graph";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import { GRAPH_NODE_TYPES, paletteColor } from "@/components/graph/DocumentNode";
import { Checkbox } from "@/components/Checkbox";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import { Toggle } from "@/components/Toggle";
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
import "./KnowledgeGraphView.css";

function KnowledgeGraphSettingsPanel({
  title,
  subtitle,
  selectedRelationKeys,
  relationFieldOptions,
  showCommunities,
  onClose,
  onSave,
  saving,
}: {
  title: string;
  subtitle: string;
  selectedRelationKeys: string[];
  relationFieldOptions: { field_key: string; field_label: string }[];
  showCommunities: boolean;
  onClose: () => void;
  onSave: (input: {
    title: string;
    subtitle: string;
    relationFields: string[];
    showCommunities: boolean;
  }) => void;
  saving: boolean;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const [draftRelations, setDraftRelations] = useState<string[]>(selectedRelationKeys);
  const [draftCommunities, setDraftCommunities] = useState(showCommunities);
  const canSave = draftTitle.trim().length > 0;

  const toggleRelation = (key: string) => {
    setDraftRelations((current) =>
      current.includes(key) ? current.filter((id) => id !== key) : [...current, key],
    );
  };

  return (
    <ViewDockPanel
      title="Graph settings"
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
              relationFields: draftRelations,
              showCommunities: draftCommunities,
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <ViewSettingsField label="Title">
        <Input value={draftTitle} onChange={setDraftTitle} placeholder="Graph title" />
      </ViewSettingsField>
      <ViewSettingsField label="Subtitle">
        <Input
          value={draftSubtitle}
          onChange={setDraftSubtitle}
          placeholder="Optional subtitle"
        />
      </ViewSettingsField>
      <ViewSettingsField
        label="Relation fields"
        hint="Leave all unchecked to include every Linked document property."
      >
        {relationFieldOptions.length > 0 ? (
          <div className="knowledge-graph-settings__relations">
            {relationFieldOptions.map((field) => (
              <Checkbox
                key={field.field_key}
                label={field.field_label}
                checked={draftRelations.includes(field.field_key)}
                onChange={() => toggleRelation(field.field_key)}
              />
            ))}
          </div>
        ) : (
          <p className="caption view-settings-field__hint">
            Add a Linked document property to build graph edges.
          </p>
        )}
      </ViewSettingsField>
      <Toggle
        label="Show communities"
        description="Color connected clusters and show a legend."
        checked={draftCommunities}
        onChange={(event) => setDraftCommunities(event.target.checked)}
      />
    </ViewDockPanel>
  );
}

export function KnowledgeGraphView() {
  const {
    workspaceId,
    openEditor,
    setDocumentTitle,
    setDocumentId,
    canWriteActiveScope,
    showToast,
    session,
  } = useApp();

  const scopesPending = !workspaceId;
  const { documents, loading, error } = useDocuments(
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
  } = useViewInstances(workspaceId, "graph", {
    canWrite: canWriteActiveScope,
    onError: (message) => showToast(message, "error"),
  });

  usePublishScopeInstanceLabel(instance?.label);

  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const config = useMemo(() => knowledgeGraphConfigFromInstance(instance), [instance]);

  const relationFieldOptions = useMemo(
    () =>
      schemas.filter((schema) =>
        (RELATION_VIEW_FIELD_TYPES as readonly string[]).includes(schema.field_type),
      ),
    [schemas],
  );

  useEffect(() => {
    setPanel(null);
    setSelectedDocId(null);
    setSearch("");
  }, [workspaceId, activeInstanceId]);

  const pageTitle = instance?.label ?? "Knowledge Graph";

  const saveSettings = async (input: {
    title: string;
    subtitle: string;
    relationFields: string[];
    showCommunities: boolean;
  }) => {
    setSavingSettings(true);
    const nextConfig = {
      ...config,
      showCommunities: input.showCommunities,
      ...(input.relationFields.length > 0
        ? { relationFields: input.relationFields }
        : { relationFields: undefined }),
      ...(input.subtitle ? { subtitle: input.subtitle } : { subtitle: undefined }),
    };
    const result = instance
      ? await updateInstance(instance.id, { label: input.title, config: nextConfig })
      : await createInstance({
          base_view_type: "graph",
          label: input.title,
          config: nextConfig,
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
        (doc) => !isDocumentArchived(doc.metadata) && isDocumentNativeToScope(doc),
      ),
    [documents],
  );
  const docsById = useMemo(() => {
    const map = new Map<string, DocumentRecord>();
    for (const doc of activeDocs) map.set(doc.id, doc);
    return map;
  }, [activeDocs]);

  const fields = useMemo(
    () => relationFields(schemas, config.relationFields),
    [schemas, config.relationFields],
  );
  const edges = useMemo(
    () => buildRelationEdges(activeDocs, fields),
    [activeDocs, fields],
  );
  const degrees = useMemo(() => computeDegrees(activeDocs, edges), [activeDocs, edges]);
  const maxDegree = useMemo(
    () => Math.max(0, ...[...degrees.values()]),
    [degrees],
  );

  const showCommunities = showCommunitiesEnabled(config);
  const communities = useMemo(
    () => (showCommunities ? detectCommunities(activeDocs, edges) : new Map<string, number>()),
    [showCommunities, activeDocs, edges],
  );

  const communityLegend = useMemo(() => {
    if (!showCommunities) return [];
    const counts = new Map<number, number>();
    for (const community of communities.values()) {
      counts.set(community, (counts.get(community) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([community, count]) => ({ community, count }));
  }, [showCommunities, communities]);

  const positions = useMemo(
    () => computeForceLayout(activeDocs.map((doc) => doc.id), edges),
    [activeDocs, edges],
  );

  const query = search.trim().toLowerCase();

  const nodes = useMemo<Node[]>(
    () =>
      activeDocs.map((doc) => {
        const position = positions.get(doc.id) ?? { x: 0, y: 0 };
        const degree = degrees.get(doc.id) ?? 0;
        const community = communities.get(doc.id);
        const dimmed = query.length > 0 && !(doc.title || "").toLowerCase().includes(query);

        return {
          id: doc.id,
          type: "document",
          position,
          data: {
            title: doc.title || "Untitled",
            emphasis: degreeEmphasis(degree, maxDegree),
            color:
              showCommunities && community !== undefined ? paletteColor(community) : undefined,
            dimmed,
            connectable: false,
          },
          draggable: true,
        };
      }),
    [activeDocs, positions, degrees, maxDegree, communities, showCommunities, query],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.fieldLabel,
      })),
    [edges],
  );

  const selectedDoc = selectedDocId ? docsById.get(selectedDocId) ?? null : null;
  const selectedConnections = useMemo(() => {
    if (!selectedDocId) return [];
    return edges
      .filter((edge) => edge.source === selectedDocId || edge.target === selectedDocId)
      .map((edge) => {
        const otherId = edge.source === selectedDocId ? edge.target : edge.source;
        const other = docsById.get(otherId);
        return {
          edge,
          direction: edge.source === selectedDocId ? "outgoing" : ("incoming" as const),
          doc: other,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          edge: RelationEdge;
          direction: "incoming" | "outgoing";
          doc: DocumentRecord;
        } => Boolean(entry.doc),
      );
  }, [selectedDocId, edges, docsById]);

  const openInEditor = (doc: DocumentRecord) => {
    cacheDocumentTitle(doc.id, doc.title);
    setDocumentTitle(doc.title);
    setDocumentId(doc.id);
    openEditor(doc.id);
  };

  const graphLoading = scopesPending || loading || schemasLoading || instancesLoading;
  const help = VIEW_HELP_CONTENT.graph;
  const infoWarnings =
    edges.length === 0
      ? [
          "No relation-linked documents yet — add a Linked document property and connect documents, e.g. from Mind-Map.",
        ]
      : [];

  return (
    <DocumentsSyncGate>
      <div className="knowledge-graph-view">
        <ViewInstanceTabBar
          className="knowledge-graph-view__tabs"
          tabs={instances.map((entry) => ({
            id: entry.id,
            label: entry.label,
          }))}
          activeId={activeInstanceId}
          onSelect={setActiveInstanceId}
          onCreate={(label) => createTab(label)}
          onDelete={(id) => deleteTab(id)}
          canEdit={canWriteActiveScope}
          createTitle="New graph"
          deleteNoun="graph"
          trailing={
            <ViewHeaderActions
              panel={panel}
              onPanelChange={setPanel}
              canEditSettings={canWriteActiveScope}
              extra={
                <div className="knowledge-graph-view__search">
                  <Input
                    icon={<Search size={14} strokeWidth={1.75} />}
                    value={search}
                    onChange={setSearch}
                    placeholder="Search documents…"
                  />
                </div>
              }
            />
          }
        />

        {instancesError ? (
          <p className="caption knowledge-graph-view__error">{instancesError}</p>
        ) : null}
        {error ? <p className="caption knowledge-graph-view__error">{error}</p> : null}

        {graphLoading ? (
          <LoaderState label="Loading knowledge graph…" />
        ) : edges.length === 0 ? (
          <p className="caption knowledge-graph-view__empty">
            No relation-linked documents yet. Add a &ldquo;Linked document&rdquo; property and
            connect documents (e.g. from the Mind-Map) to see them here.
          </p>
        ) : (
          <div className="knowledge-graph-view__canvas">
            <ReactFlow
              nodes={nodes}
              edges={flowEdges}
              nodeTypes={GRAPH_NODE_TYPES}
              nodesConnectable={false}
              nodesDraggable
              elementsSelectable
              onNodeClick={(_event, node) => setSelectedDocId(node.id)}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>

            {communityLegend.length > 0 ? (
              <div className="knowledge-graph-legend">
                {communityLegend.map(({ community, count }) => (
                  <span key={community} className="knowledge-graph-legend__item">
                    <span
                      className="knowledge-graph-legend__dot"
                      style={{ background: paletteColor(community) }}
                    />
                    Group {community + 1} · {count}
                  </span>
                ))}
              </div>
            ) : null}

            {selectedDoc && panel === null ? (
              <aside className="knowledge-graph-explain">
                <header className="knowledge-graph-explain__header">
                  <h3 className="knowledge-graph-explain__title">
                    {selectedDoc.title || "Untitled"}
                  </h3>
                  <button
                    type="button"
                    aria-label="Close panel"
                    className="knowledge-graph-explain__icon-button"
                    onClick={() => setSelectedDocId(null)}
                  >
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </header>
                <p className="caption knowledge-graph-explain__meta">
                  {selectedConnections.length} connection
                  {selectedConnections.length === 1 ? "" : "s"}
                </p>
                <ul className="knowledge-graph-explain__list">
                  {selectedConnections.map(({ edge, direction, doc }) => (
                    <li key={edge.id}>
                      <button
                        type="button"
                        className="knowledge-graph-explain__connection"
                        onClick={() => setSelectedDocId(doc.id)}
                      >
                        <span className="knowledge-graph-explain__connection-title">
                          {doc.title || "Untitled"}
                        </span>
                        <span className="caption knowledge-graph-explain__connection-field">
                          {direction === "outgoing" ? "→" : "←"} {edge.fieldLabel}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="knowledge-graph-explain__open-button"
                  onClick={() => openInEditor(selectedDoc)}
                >
                  <ExternalLink size={14} strokeWidth={1.75} />
                  Open in Editor
                </button>
              </aside>
            ) : null}
          </div>
        )}

        {panel === "settings" ? (
          <KnowledgeGraphSettingsPanel
            title={pageTitle}
            subtitle={config.subtitle ?? ""}
            selectedRelationKeys={config.relationFields ?? []}
            relationFieldOptions={relationFieldOptions}
            showCommunities={showCommunities}
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
      </div>
    </DocumentsSyncGate>
  );
}
