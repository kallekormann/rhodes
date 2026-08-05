"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
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
import { openKnowledgeSourcePreview } from "@/lib/library/preview";
import {
  buildCitationEdges,
  walkCitationNodes,
  type CitationEdge,
} from "@/lib/views/citation-graph";
import {
  degreeEmphasis,
  knowledgeGraphConfigFromInstance,
  LIBRARY_NODE_COLOR,
  showCommunitiesEnabled,
  showLibraryNodesEnabled,
} from "@/lib/views/knowledge-graph";
import {
  buildRelationEdges,
  computeDegrees,
  detectCommunities,
  relationFields,
  type GraphDocument,
  type RelationEdge,
} from "@/lib/views/relation-graph";
import { knowledgeGraphEmptyCopy } from "@/lib/views/empty-states";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import { paletteColor } from "@/components/graph/DocumentNode";
import {
  KnowledgeGraph3D,
  type KnowledgeGraph3DLink,
  type KnowledgeGraph3DNode,
} from "@/components/graph/KnowledgeGraph3D";
import { Checkbox } from "@/components/Checkbox";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import { Toggle } from "@/components/Toggle";
import { ViewEmptyState } from "@/components/ViewEmptyState";
import {
  ViewDockPanel,
  ViewSettingsField,
} from "@/components/views/ViewDockPanel";
import {
  ViewHeaderActions,
  type ViewPanelMode,
} from "@/components/views/ViewHeaderActions";
import { ViewInfoPanel } from "@/components/views/ViewInfoPanel";
import { ViewDocumentPanelHost } from "@/components/views/ViewDocumentPanelHost";
import type {
  ViewDocumentPanelConnection,
  ViewDocumentPanelState,
} from "@/components/views/view-document-panel-types";
import "./KnowledgeGraphView.css";

type LibrarySourceNode = { id: string; title: string };

type GraphDisplayEdge = RelationEdge | CitationEdge;

async function fetchAllLibrarySources(
  workspaceId: string,
): Promise<LibrarySourceNode[]> {
  const collected: LibrarySourceNode[] = [];
  const limit = 50;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      limit: String(limit),
      offset: String(offset),
    });
    const response = await fetch(`/app/api/library?${params}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : "Failed to load library",
      );
    }
    const sources = (data.sources as { id: string; file_name?: string }[]) ?? [];
    total = typeof data.total === "number" ? data.total : sources.length;
    for (const source of sources) {
      collected.push({
        id: source.id,
        title: source.file_name?.trim() || "Library file",
      });
    }
    if (sources.length === 0) break;
    offset += sources.length;
  }

  return collected;
}

async function fetchDocumentBodies(
  workspaceId: string,
): Promise<Map<string, unknown>> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    filter: "all",
    include_body: "true",
  });
  const response = await fetch(`/app/api/documents?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to load document bodies",
    );
  }
  const map = new Map<string, unknown>();
  for (const doc of (data.documents as DocumentRecord[]) ?? []) {
    if (doc.content) map.set(doc.id, doc.content);
  }
  return map;
}

async function resolveCitationRefs(
  workspaceId: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const response = await fetch("/app/api/library/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, ids }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return new Map();
  const map = new Map<string, string>();
  const raw = (data.map ?? {}) as Record<string, string>;
  for (const [from, to] of Object.entries(raw)) {
    map.set(from, to);
  }
  return map;
}

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
    setView,
  } = useApp();

  const scopesPending = !workspaceId;
  const { documents, loading, error } = useDocuments(
    workspaceId,
    "all",
    session.userId,
  );
  const { schemas, loading: schemasLoading } = useMetadataSchemas(workspaceId);
  const {
    activeInstance: instance,
    activeId: activeInstanceId,
    loading: instancesLoading,
    error: instancesError,
    updateInstance,
    createInstance,
  } = useViewInstances(workspaceId, "graph", {
    canWrite: canWriteActiveScope,
    onError: (message) => showToast(message, "error"),
  });

  usePublishScopeInstanceLabel(instance?.label);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docPanel, setDocPanel] = useState<ViewDocumentPanelState>({
    mode: "closed",
  });
  const [fitToken, setFitToken] = useState(0);
  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [librarySources, setLibrarySources] = useState<LibrarySourceNode[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [bodyById, setBodyById] = useState<Map<string, unknown>>(new Map());
  const [chunkToSourceId, setChunkToSourceId] = useState<Map<string, string>>(
    () => new Map(),
  );

  const config = useMemo(() => knowledgeGraphConfigFromInstance(instance), [instance]);
  const includeLibrary = showLibraryNodesEnabled(config);

  const relationFieldOptions = useMemo(
    () =>
      schemas.filter((schema) =>
        (RELATION_VIEW_FIELD_TYPES as readonly string[]).includes(schema.field_type),
      ),
    [schemas],
  );

  useEffect(() => {
    setPanel(null);
    setSelectedId(null);
    setDocPanel({ mode: "closed" });
    setSearch("");
  }, [workspaceId, activeInstanceId]);

  useEffect(() => {
    if (!workspaceId || !includeLibrary) {
      setLibrarySources([]);
      return;
    }
    let cancelled = false;
    setLibraryLoading(true);
    void fetchAllLibrarySources(workspaceId)
      .then((sources) => {
        if (!cancelled) setLibrarySources(sources);
      })
      .catch(() => {
        if (!cancelled) setLibrarySources([]);
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, includeLibrary]);

  useEffect(() => {
    if (!workspaceId) {
      setBodyById(new Map());
      return;
    }
    let cancelled = false;
    void fetchDocumentBodies(workspaceId)
      .then((map) => {
        if (!cancelled) setBodyById(map);
      })
      .catch(() => {
        if (!cancelled) setBodyById(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, documents]);

  useEffect(() => {
    if (!workspaceId || !includeLibrary) {
      setChunkToSourceId(new Map());
      return;
    }
    const libraryIds = new Set(librarySources.map((source) => source.id));
    const unresolved = new Set<string>();
    for (const content of bodyById.values()) {
      for (const ref of walkCitationNodes(content)) {
        if (libraryIds.has(ref.sourceRefId)) continue;
        unresolved.add(ref.sourceRefId);
      }
    }
    if (unresolved.size === 0) {
      setChunkToSourceId(new Map());
      return;
    }
    let cancelled = false;
    void resolveCitationRefs(workspaceId, [...unresolved]).then((map) => {
      if (!cancelled) setChunkToSourceId(map);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, includeLibrary, librarySources, bodyById]);

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
  const libraryById = useMemo(() => {
    const map = new Map<string, LibrarySourceNode>();
    for (const source of librarySources) map.set(source.id, source);
    return map;
  }, [librarySources]);

  const fields = useMemo(
    () => relationFields(schemas, config.relationFields),
    [schemas, config.relationFields],
  );
  const relationEdges = useMemo(
    () => buildRelationEdges(activeDocs, fields),
    [activeDocs, fields],
  );

  const citationEdges = useMemo(() => {
    if (!includeLibrary) return [] as CitationEdge[];
    const libraryIds = new Set(librarySources.map((source) => source.id));
    const docsWithBodies = activeDocs.map((doc) => ({
      id: doc.id,
      content: bodyById.get(doc.id) ?? doc.content,
    }));
    return buildCitationEdges(docsWithBodies, libraryIds, chunkToSourceId);
  }, [includeLibrary, librarySources, activeDocs, bodyById, chunkToSourceId]);

  const edges = useMemo<GraphDisplayEdge[]>(
    () => [...relationEdges, ...citationEdges],
    [relationEdges, citationEdges],
  );

  /** Documents that participate in at least one relation or citation edge. */
  const connectedDocs = useMemo(() => {
    const ids = new Set<string>();
    for (const edge of edges) {
      if (docsById.has(edge.source)) ids.add(edge.source);
      if (docsById.has(edge.target)) ids.add(edge.target);
    }
    return activeDocs.filter((doc) => ids.has(doc.id));
  }, [activeDocs, edges, docsById]);

  const graphEntities = useMemo<GraphDocument[]>(() => {
    const entities: GraphDocument[] = connectedDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      metadata: doc.metadata,
    }));
    if (includeLibrary) {
      for (const source of librarySources) {
        entities.push({ id: source.id, title: source.title, metadata: null });
      }
    }
    return entities;
  }, [connectedDocs, includeLibrary, librarySources]);

  const degrees = useMemo(
    () => computeDegrees(graphEntities, edges as RelationEdge[]),
    [graphEntities, edges],
  );
  const maxDegree = useMemo(
    () => Math.max(0, ...[...degrees.values()]),
    [degrees],
  );

  const showCommunities = showCommunitiesEnabled(config);
  const communities = useMemo(
    () =>
      showCommunities
        ? detectCommunities(graphEntities, edges as RelationEdge[])
        : new Map<string, number>(),
    [showCommunities, graphEntities, edges],
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

  const query = search.trim().toLowerCase();

  const graphNodes = useMemo<KnowledgeGraph3DNode[]>(() => {
    const nodes: KnowledgeGraph3DNode[] = connectedDocs.map((doc) => {
      const degree = degrees.get(doc.id) ?? 0;
      const community = communities.get(doc.id);
      return {
        id: doc.id,
        name: doc.title?.trim() || "Untitled",
        kind: "document",
        degree,
        emphasis: degreeEmphasis(degree, maxDegree),
        color:
          showCommunities && community !== undefined
            ? paletteColor(community)
            : paletteColor(0),
      };
    });
    if (includeLibrary) {
      for (const source of librarySources) {
        const degree = degrees.get(source.id) ?? 0;
        nodes.push({
          id: source.id,
          name: source.title,
          kind: "library",
          degree,
          emphasis: degreeEmphasis(degree, maxDegree),
          color: LIBRARY_NODE_COLOR,
        });
      }
    }
    return nodes;
  }, [
    connectedDocs,
    includeLibrary,
    librarySources,
    degrees,
    maxDegree,
    communities,
    showCommunities,
  ]);

  const graphLinks = useMemo<KnowledgeGraph3DLink[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        fieldLabel: edge.fieldLabel,
      })),
    [edges],
  );

  const selectedConnections = useMemo<ViewDocumentPanelConnection[]>(() => {
    if (!selectedId || !docsById.has(selectedId)) return [];
    return edges
      .filter((edge) => edge.source === selectedId || edge.target === selectedId)
      .map((edge) => {
        const otherId = edge.source === selectedId ? edge.target : edge.source;
        const otherDoc = docsById.get(otherId);
        const otherLib = libraryById.get(otherId);
        if (!otherDoc && !otherLib) return null;
        return {
          documentId: otherId,
          title: otherDoc
            ? otherDoc.title?.trim() || "Untitled"
            : otherLib?.title || "Library file",
          direction:
            edge.source === selectedId
              ? ("outgoing" as const)
              : ("incoming" as const),
          fieldLabel: edge.fieldLabel,
        };
      })
      .filter((entry): entry is ViewDocumentPanelConnection => entry != null);
  }, [selectedId, edges, docsById, libraryById]);

  const selectDocument = (docId: string) => {
    setSelectedId(docId);
    setDocPanel({ mode: "viewing", documentId: docId });
    setPanel(null);
  };

  const selectNode = (nodeId: string) => {
    if (libraryById.has(nodeId)) {
      setSelectedId(nodeId);
      setDocPanel({ mode: "closed" });
      setPanel(null);
      openKnowledgeSourcePreview({
        originType: "library",
        sourceRefId: nodeId,
      });
      return;
    }
    selectDocument(nodeId);
  };

  const selectConnection = (id: string) => {
    if (libraryById.has(id)) {
      setSelectedId(id);
      openKnowledgeSourcePreview({
        originType: "library",
        sourceRefId: id,
      });
      return;
    }
    selectDocument(id);
  };

  const openFullPage = (documentId: string, title?: string) => {
    const doc = docsById.get(documentId);
    const resolvedTitle = title ?? doc?.title ?? "Untitled";
    cacheDocumentTitle(documentId, resolvedTitle);
    setDocumentTitle(resolvedTitle);
    setDocumentId(documentId);
    openEditor(documentId);
  };

  const handleSearchChange = (next: string) => {
    setSearch(next);
    setFitToken((token) => token + 1);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    const match = graphNodes.find((node) => node.name.toLowerCase().includes(q));
    if (!match) return;
    event.preventDefault();
    selectNode(match.id);
    setFitToken((token) => token + 1);
  };

  const graphLoading =
    scopesPending || loading || schemasLoading || instancesLoading || libraryLoading;
  const help = VIEW_HELP_CONTENT.graph;
  const hasGraphContent = graphNodes.length > 0;
  const infoWarnings =
    edges.length === 0 && librarySources.length === 0
      ? [
          "No relation-linked documents or library files yet — add a Linked document property, cite a library file, or upload to Library.",
        ]
      : [];

  return (
    <DocumentsSyncGate>
      <div className="knowledge-graph-view">
        <header className="knowledge-graph-view__header">
          <ViewHeaderActions
            panel={panel}
            onPanelChange={setPanel}
            canEditSettings={canWriteActiveScope}
            extra={
              <div className="knowledge-graph-view__search">
                <Input
                  icon={<Search size={14} strokeWidth={1.75} />}
                  value={search}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search documents & library…"
                />
              </div>
            }
          />
        </header>

        {instancesError ? (
          <p className="caption knowledge-graph-view__error">{instancesError}</p>
        ) : null}
        {error ? <p className="caption knowledge-graph-view__error">{error}</p> : null}

        {graphLoading ? (
          <LoaderState label="Loading knowledge graph…" align="fill" />
        ) : !hasGraphContent ? (
          <ViewEmptyState
            layout="panel"
            title={knowledgeGraphEmptyCopy(canWriteActiveScope).title}
            description={knowledgeGraphEmptyCopy(canWriteActiveScope).description}
            primaryAction={
              canWriteActiveScope
                ? {
                    label: "Open Library",
                    onClick: () => setView("library"),
                  }
                : undefined
            }
          />
        ) : (
          <div className="knowledge-graph-view__canvas">
            <KnowledgeGraph3D
              nodes={graphNodes}
              links={graphLinks}
              selectedId={selectedId}
              searchQuery={query}
              fitToken={fitToken}
              panelOpen={docPanel.mode === "viewing"}
              onNodeClick={selectNode}
            />

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

        <ViewDocumentPanelHost
          state={docPanel}
          onClose={() => {
            setDocPanel({ mode: "closed" });
            setSelectedId(null);
          }}
          onOpenFullPage={openFullPage}
          connections={selectedConnections}
          onSelectConnection={selectConnection}
        />
      </div>
    </DocumentsSyncGate>
  );
}
