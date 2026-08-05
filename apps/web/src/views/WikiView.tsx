"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PanelLeftClose, PanelLeft, Plus, Search } from "lucide-react";
import {
  createEmptyWikiLayout,
  normalizeWikiLayout,
  resolveWikiConfig,
  type WikiLayout,
} from "@rhodes/shared/view-engine";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { IconButton } from "@/components/IconButton";
import { IconLabelButton } from "@/components/IconLabelButton";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import { ViewEmptyState } from "@/components/ViewEmptyState";
import { wikiEmptyCopy } from "@/lib/views/empty-states";
import { WikiTree } from "@/components/wiki/WikiTree";
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
import { ViewInstanceTabBar } from "@/components/views/ViewInstanceTabBar";
import { ViewInfoPanel } from "@/components/views/ViewInfoPanel";
import { useApp } from "@/context/AppContext";
import { useCreateDocument } from "@/hooks/useCreateDocument";
import { useDocuments } from "@/hooks/useDocuments";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePublishScopeInstanceLabel } from "@/hooks/usePublishScopeInstanceLabel";
import { useViewInstances } from "@/hooks/useViewInstances";
import { withUserMetadataValue } from "@/lib/metadata/schemas";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import {
  appendChildOrder,
  buildWikiTree,
  parentMapFromDocuments,
  removeChildOrder,
  reorderSiblings,
  resolveWikiDrop,
  wikiBreadcrumb,
} from "@/lib/views/wiki";
import { EmbeddedDocumentEditor } from "@/views/EditorView";
import "./WikiView.css";

function selectionStorageKey(workspaceId: string, instanceId: string): string {
  return `rhodes:wiki-selection:${workspaceId}:${instanceId}`;
}

function railStorageKey(workspaceId: string): string {
  return `rhodes:wiki-rail-collapsed:${workspaceId}`;
}

function railWidthStorageKey(workspaceId: string): string {
  return `rhodes:wiki-rail-width:${workspaceId}`;
}

const RAIL_WIDTH_DEFAULT = 260;
const RAIL_WIDTH_MIN = 180;
const RAIL_WIDTH_MAX = 480;
const RAIL_COLLAPSED_WIDTH = 48;

function clampRailWidth(width: number): number {
  return Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, Math.round(width)));
}

function WikiSettingsPanel({
  title,
  subtitle,
  onClose,
  onSave,
  saving,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSave: (input: { title: string; subtitle: string }) => void;
  saving: boolean;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const canSave = draftTitle.trim().length > 0;

  return (
    <ViewDockPanel
      title="Wiki settings"
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
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <ViewSettingsField label="Title">
        <Input value={draftTitle} onChange={setDraftTitle} placeholder="Space name" />
      </ViewSettingsField>
      <ViewSettingsField label="Subtitle">
        <Input
          value={draftSubtitle}
          onChange={setDraftSubtitle}
          placeholder="Optional subtitle"
        />
      </ViewSettingsField>
    </ViewDockPanel>
  );
}

export function WikiView() {
  const {
    workspaceId,
    canWriteActiveScope,
    showToast,
    session,
    documentTitle,
    documentId: appDocumentId,
    openEditor,
  } = useApp();
  const scopesPending = !workspaceId;
  const { online } = useOnlineStatus(workspaceId);
  const { createDocument } = useCreateDocument(
    workspaceId,
    session.userId,
    online,
  );
  const {
    documents,
    loading,
    error,
    updateDocument,
    refresh,
  } = useDocuments(workspaceId, "all", session.userId);

  const {
    instances,
    activeInstance: instance,
    activeId: activeInstanceId,
    setActiveId: setActiveInstanceId,
    loading: instancesLoading,
    error: instancesError,
    updateInstance,
    createTab,
    deleteTab,
  } = useViewInstances(workspaceId, "wiki", {
    canWrite: canWriteActiveScope,
    onError: (message) => showToast(message, "error"),
  });

  usePublishScopeInstanceLabel(instance?.label);

  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [railWidth, setRailWidth] = useState(RAIL_WIDTH_DEFAULT);
  const [railResizing, setRailResizing] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docPanel, setDocPanel] = useState<ViewDocumentPanelState>({
    mode: "closed",
  });
  const [seedingRoot, setSeedingRoot] = useState(false);
  const [pendingRoot, setPendingRoot] = useState<{
    id: string;
    title: string;
  } | null>(null);
  /** Titles committed when leaving a page (live editor title), keyed by doc id. */
  const [committedTitles, setCommittedTitles] = useState<
    Record<string, string>
  >({});
  const selectedIdRef = useRef<string | null>(null);
  const liveTitleRef = useRef<{ id: string; title: string } | null>(null);
  const seededRootForInstance = useRef<string | null>(null);
  const creatingFirstTab = useRef(false);
  const seedingInFlight = useRef(false);
  const healingRoot = useRef(false);
  const healedInstanceId = useRef<string | null>(null);
  const fetchingMissingRoot = useRef<string | null>(null);
  const [rootBusy, setRootBusy] = useState(false);

  const config = useMemo(
    () => resolveWikiConfig(instance?.config ?? null),
    [instance?.config],
  );
  const layout = useMemo(
    () => normalizeWikiLayout(instance?.layout),
    [instance?.layout],
  );
  const relationField = config.relationField ?? "origin";
  const rootDocumentId =
    typeof config.rootDocumentId === "string" && config.rootDocumentId
      ? config.rootDocumentId
      : null;

  const wikiDocs = useMemo(() => {
    // Live editor title only overlays the selected page when session id matches.
    // Never write that title onto other nodes (that caused the tree title bleed).
    const liveTitle =
      selectedId &&
      appDocumentId === selectedId &&
      documentTitle.trim().length > 0
        ? documentTitle.trim()
        : null;

    const resolveTitle = (id: string, fallback: string) => {
      if (liveTitle && id === selectedId) return liveTitle;
      return committedTitles[id] ?? fallback;
    };

    const docs = documents.map((doc) => ({
      id: doc.id,
      title: resolveTitle(doc.id, doc.title?.trim() || "Untitled"),
      metadata: doc.metadata,
    }));
    if (
      pendingRoot &&
      !docs.some((doc) => doc.id === pendingRoot.id)
    ) {
      docs.push({
        id: pendingRoot.id,
        title: resolveTitle(
          pendingRoot.id,
          pendingRoot.title?.trim() || "Untitled",
        ),
        metadata: null,
      });
    }
    return docs;
  }, [
    documents,
    pendingRoot,
    selectedId,
    appDocumentId,
    documentTitle,
    committedTitles,
  ]);

  useEffect(() => {
    if (!pendingRoot) return;
    if (documents.some((doc) => doc.id === pendingRoot.id)) {
      setPendingRoot(null);
    }
  }, [documents, pendingRoot]);

  // Track a trusted live title only while session id === tree selection.
  useEffect(() => {
    if (
      selectedId &&
      appDocumentId === selectedId &&
      documentTitle.trim().length > 0
    ) {
      liveTitleRef.current = {
        id: selectedId,
        title: documentTitle.trim(),
      };
    }
  }, [selectedId, appDocumentId, documentTitle]);

  // When selection changes, commit the previous page's live title into the tree.
  useEffect(() => {
    const previousId = selectedIdRef.current;
    selectedIdRef.current = selectedId;
    if (!previousId || previousId === selectedId) return;
    const live = liveTitleRef.current;
    if (!live || live.id !== previousId) return;
    setCommittedTitles((prev) => {
      if (prev[previousId] === live.title) return prev;
      return { ...prev, [previousId]: live.title };
    });
    if (liveTitleRef.current?.id === previousId) {
      liveTitleRef.current = null;
    }
  }, [selectedId]);

  // Drop committed overrides once the documents list catches up.
  useEffect(() => {
    setCommittedTitles((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const [id, title] of Object.entries(prev)) {
        const doc = documents.find((entry) => entry.id === id);
        if (doc && (doc.title?.trim() || "Untitled") === title) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [documents]);

  const tree = useMemo(() => {
    if (!rootDocumentId) return null;
    return buildWikiTree(wikiDocs, rootDocumentId, layout, relationField);
  }, [wikiDocs, rootDocumentId, layout, relationField]);

  // If Space home exists in config but is missing from the documents list, fetch it.
  useEffect(() => {
    if (!rootDocumentId || loading) return;
    if (wikiDocs.some((doc) => doc.id === rootDocumentId)) return;
    if (fetchingMissingRoot.current === rootDocumentId) return;
    fetchingMissingRoot.current = rootDocumentId;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/app/api/documents/${rootDocumentId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;
        const doc = data.document as { id?: string; title?: string } | undefined;
        if (!doc?.id) return;
        setPendingRoot({
          id: doc.id,
          title: doc.title?.trim() || "Untitled",
        });
        if (!selectedId) setSelectedId(doc.id);
      } finally {
        if (fetchingMissingRoot.current === rootDocumentId) {
          fetchingMissingRoot.current = null;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootDocumentId, loading, wikiDocs, selectedId]);

  // Heal tabs that have a selected Space-home doc but never persisted rootDocumentId.
  useEffect(() => {
    if (!canWriteActiveScope || !instance || rootDocumentId) return;
    if (!selectedId || instancesLoading || loading) return;
    if (healedInstanceId.current === instance.id) return;
    if (healingRoot.current || seedingInFlight.current) return;
    healingRoot.current = true;
    healedInstanceId.current = instance.id;
    setRootBusy(true);
    const priorConfig = instance.config ?? {};
    const fallbackTitle =
      documents.find((doc) => doc.id === selectedId)?.title ||
      instance.label?.trim() ||
      "Space home";
    void updateInstance(instance.id, {
      config: {
        ...priorConfig,
        rootDocumentId: selectedId,
        defaultTemplateSlug:
          typeof priorConfig.defaultTemplateSlug === "string"
            ? priorConfig.defaultTemplateSlug
            : "blank",
      },
    }).then((result) => {
      healingRoot.current = false;
      setRootBusy(false);
      if (!result.ok) {
        healedInstanceId.current = null;
        showToast(result.error, "error");
        return;
      }
      seededRootForInstance.current = instance.id;
      setPendingRoot({
        id: selectedId,
        title: fallbackTitle,
      });
    });
  }, [
    canWriteActiveScope,
    instance,
    rootDocumentId,
    selectedId,
    instancesLoading,
    loading,
    updateInstance,
    showToast,
    documents,
  ]);

  const breadcrumbs = useMemo(
    () => (tree && selectedId ? wikiBreadcrumb(tree, selectedId) : []),
    [tree, selectedId],
  );

  useEffect(() => {
    if (!workspaceId) return;
    try {
      setRailCollapsed(
        window.localStorage.getItem(railStorageKey(workspaceId)) === "1",
      );
      const storedWidth = Number(
        window.localStorage.getItem(railWidthStorageKey(workspaceId)),
      );
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        setRailWidth(clampRailWidth(storedWidth));
      }
    } catch {
      setRailCollapsed(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !activeInstanceId) return;
    healedInstanceId.current = null;
    try {
      const stored = window.localStorage.getItem(
        selectionStorageKey(workspaceId, activeInstanceId),
      );
      if (stored) setSelectedId(stored);
      else if (rootDocumentId) setSelectedId(rootDocumentId);
    } catch {
      if (rootDocumentId) setSelectedId(rootDocumentId);
    }
  }, [workspaceId, activeInstanceId, rootDocumentId]);

  useEffect(() => {
    if (!workspaceId || !activeInstanceId || !selectedId) return;
    try {
      window.localStorage.setItem(
        selectionStorageKey(workspaceId, activeInstanceId),
        selectedId,
      );
    } catch {
      // ignore
    }
  }, [workspaceId, activeInstanceId, selectedId]);

  useEffect(() => {
    setDocPanel((prev) => {
      if (prev.mode === "pick-template") return prev;
      if (selectedId) return { mode: "editing", documentId: selectedId };
      return { mode: "closed" };
    });
  }, [selectedId]);

  const persistLayout = useCallback(
    async (next: WikiLayout) => {
      if (!instance) return;
      const result = await updateInstance(instance.id, { layout: next });
      if (!result.ok) showToast(result.error, "error");
    },
    [instance, updateInstance, showToast],
  );

  // Ensure at least one Space tab exists once instances have loaded.
  useEffect(() => {
    if (!canWriteActiveScope || !workspaceId) return;
    if (instancesLoading || scopesPending) return;
    if (instances.length > 0) return;
    if (creatingFirstTab.current) return;
    creatingFirstTab.current = true;
    void createTab("Wiki").finally(() => {
      creatingFirstTab.current = false;
    });
  }, [
    canWriteActiveScope,
    workspaceId,
    instancesLoading,
    scopesPending,
    instances.length,
    createTab,
  ]);

  // Seed Space home document when the active tab has no rootDocumentId.
  useEffect(() => {
    const instanceId = instance?.id ?? null;
    if (!canWriteActiveScope || !workspaceId || !instanceId) return;
    if (rootDocumentId) {
      seededRootForInstance.current = instanceId;
      return;
    }
    // A restored selection is healed into rootDocumentId instead of creating a second home.
    if (selectedId) return;
    if (instancesLoading || loading) return;
    if (seededRootForInstance.current === instanceId) return;
    if (seedingInFlight.current || healingRoot.current) return;

    const label = instance?.label?.trim() || "Space home";
    const priorConfig = instance?.config ?? {};
    seedingInFlight.current = true;
    setSeedingRoot(true);
    setRootBusy(true);

    void (async () => {
      try {
        const created = await createDocument({ title: label });
        if (!created) {
          showToast("Couldn't create Space home", "error");
          seededRootForInstance.current = instanceId;
          return;
        }
        setPendingRoot({ id: created.id, title: created.title || label });
        const result = await updateInstance(instanceId, {
          config: {
            ...priorConfig,
            rootDocumentId: created.id,
            defaultTemplateSlug: "blank",
          },
          layout: createEmptyWikiLayout(),
        });
        if (!result.ok) {
          showToast(result.error, "error");
          seededRootForInstance.current = instanceId;
          setPendingRoot(null);
          return;
        }
        seededRootForInstance.current = instanceId;
        setSelectedId(created.id);
        await refresh();
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Couldn't create Space home",
          "error",
        );
        seededRootForInstance.current = instanceId;
        setPendingRoot(null);
      } finally {
        seedingInFlight.current = false;
        setSeedingRoot(false);
        setRootBusy(false);
      }
    })();
  }, [
    canWriteActiveScope,
    workspaceId,
    instance?.id,
    instance?.label,
    instance?.config,
    rootDocumentId,
    selectedId,
    instancesLoading,
    loading,
    createDocument,
    updateInstance,
    showToast,
    refresh,
  ]);

  const selectPage = useCallback((documentId: string) => {
    setSelectedId(documentId);
    setDocPanel({ mode: "editing", documentId });
  }, []);

  const startCreate = useCallback(
    (parentId: string) => {
      if (!canWriteActiveScope) {
        showToast("You have read-only access in this scope", "error");
        return;
      }
      const parent = wikiDocs.find((doc) => doc.id === parentId);
      setDocPanel({
        mode: "pick-template",
        viewType: "wiki",
        createContext: {
          kind: "child",
          parentDocId: parentId,
          parentTitle: parent?.title ?? "Untitled",
        },
      });
    },
    [canWriteActiveScope, showToast, wikiDocs],
  );

  const handleDocumentCreated = useCallback(
    async (
      doc: { id: string; title: string },
      createContext?: ViewDocumentCreateContext,
    ) => {
      // Open the editor immediately so the center pane shows its loader
      // instead of flashing the template picker after create finishes.
      selectPage(doc.id);
      if (createContext?.kind === "child" && instance) {
        const nextLayout = appendChildOrder(
          normalizeWikiLayout(instance.layout),
          createContext.parentDocId,
          doc.id,
        );
        await persistLayout(nextLayout);
      }
      void refresh();
    },
    [instance, persistLayout, refresh, selectPage],
  );

  const handleDrop = useCallback(
    async (
      draggedId: string,
      targetId: string,
      position: "on" | "before" | "after",
    ) => {
      if (!canWriteActiveScope || !rootDocumentId || !instance) return;
      const { parentByChild, childrenByParent } = parentMapFromDocuments(
        wikiDocs,
        relationField,
      );
      const orderedChildren = new Map<string, string[]>();
      for (const [parentId, kids] of childrenByParent) {
        const preferred = layout.order[parentId];
        if (!preferred) {
          orderedChildren.set(parentId, kids);
          continue;
        }
        const rank = new Map(preferred.map((id, i) => [id, i]));
        orderedChildren.set(
          parentId,
          [...kids].sort((a, b) => {
            const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
            const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
            return ra - rb || a.localeCompare(b);
          }),
        );
      }

      const result = resolveWikiDrop({
        draggedId,
        targetId,
        dropPosition: position,
        rootId: rootDocumentId,
        parentByChild,
        childrenByParent: orderedChildren,
      });

      if (result.kind === "invalid") {
        showToast(result.reason, "warning");
        return;
      }

      if (result.kind === "reorder") {
        await persistLayout(
          reorderSiblings(layout, result.parentId, result.orderedChildIds),
        );
        return;
      }

      // Prefer the documents-list record (full metadata) over the tree projection.
      const childDoc = wikiDocs.find((doc) => doc.id === result.childId);
      const parentInTree = wikiDocs.some((doc) => doc.id === result.newParentId);
      if (!childDoc || !parentInTree) {
        showToast("Couldn't move page — missing document", "error");
        return;
      }

      const listChild = documents.find((doc) => doc.id === result.childId);
      const listParent = documents.find((doc) => doc.id === result.newParentId);
      let baseMeta = listChild?.metadata ?? childDoc.metadata ?? null;
      const parentTitle =
        listParent?.title ||
        wikiDocs.find((doc) => doc.id === result.newParentId)?.title ||
        "Untitled";

      // If the list row is missing metadata, fetch once so we don't wipe fields.
      if (!baseMeta || Object.keys(baseMeta).length === 0) {
        try {
          const response = await fetch(`/app/api/documents/${result.childId}`);
          const data = await response.json().catch(() => ({}));
          if (response.ok && data.document?.metadata) {
            baseMeta = data.document.metadata as Record<string, unknown>;
          }
        } catch {
          // fall through with whatever we have
        }
      }

      const nextMeta = withUserMetadataValue(baseMeta, relationField, {
        document_id: result.newParentId,
        title: parentTitle,
      }) as Record<string, unknown>;
      const updated = await updateDocument(result.childId, {
        metadata: nextMeta,
      });
      if (!updated) {
        showToast("Couldn't move page", "error");
        return;
      }

      let nextLayout = layout;
      if (result.previousParentId) {
        nextLayout = removeChildOrder(
          nextLayout,
          result.previousParentId,
          result.childId,
        );
      }
      if (result.orderedChildIds) {
        nextLayout = reorderSiblings(
          nextLayout,
          result.newParentId,
          result.orderedChildIds,
        );
      } else {
        nextLayout = appendChildOrder(
          nextLayout,
          result.newParentId,
          result.childId,
        );
      }
      await persistLayout(nextLayout);
      void refresh();
    },
    [
      canWriteActiveScope,
      rootDocumentId,
      instance,
      wikiDocs,
      documents,
      relationField,
      layout,
      updateDocument,
      persistLayout,
      refresh,
      showToast,
    ],
  );

  const saveSettings = async (input: { title: string; subtitle: string }) => {
    if (!instance) return;
    setSavingSettings(true);
    try {
      const result = await updateInstance(instance.id, {
        label: input.title,
        config: {
          ...(instance.config ?? {}),
          ...(input.subtitle
            ? { subtitle: input.subtitle }
            : { subtitle: undefined }),
        },
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setPanel(null);
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleRail = () => {
    setRailCollapsed((prev) => {
      const next = !prev;
      if (workspaceId) {
        try {
          window.localStorage.setItem(
            railStorageKey(workspaceId),
            next ? "1" : "0",
          );
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const startRailResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (railCollapsed) return;
      event.preventDefault();
      const handle = event.currentTarget;
      const startX = event.clientX;
      const startWidth = railWidth;
      handle.setPointerCapture(event.pointerId);
      setRailResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvent: PointerEvent) => {
        const next = clampRailWidth(startWidth + (moveEvent.clientX - startX));
        setRailWidth(next);
      };

      const onUp = (upEvent: PointerEvent) => {
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        setRailResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const finalWidth = clampRailWidth(
          startWidth + (upEvent.clientX - startX),
        );
        setRailWidth(finalWidth);
        if (workspaceId) {
          try {
            window.localStorage.setItem(
              railWidthStorageKey(workspaceId),
              String(finalWidth),
            );
          } catch {
            // ignore
          }
        }
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [railCollapsed, railWidth, workspaceId],
  );

  const pageLoading = scopesPending || instancesLoading;
  const help = VIEW_HELP_CONTENT.wiki;

  return (
    <DocumentsSyncGate>
      <div className="wiki-view">
        <ViewInstanceTabBar
          className="wiki-view__tabs"
          tabs={instances.map((entry) => ({
            id: entry.id,
            label: entry.label,
          }))}
          activeId={activeInstanceId}
          onSelect={setActiveInstanceId}
          onCreate={(label) => {
            void createTab(label).then((result) => {
              if (result.ok) {
                seededRootForInstance.current = null;
                healedInstanceId.current = null;
              }
            });
          }}
          onDelete={(id) => deleteTab(id)}
          canEdit={canWriteActiveScope}
          createTitle="New Space"
          createPlaceholder="Space name"
          deleteNoun="Space"
          trailing={
            <ViewHeaderActions
              panel={panel}
              onPanelChange={(next) => {
                setPanel(next);
              }}
              canEditSettings={canWriteActiveScope}
            />
          }
        />

        {instancesError ? (
          <p className="caption wiki-view__error">{instancesError}</p>
        ) : null}
        {error ? <p className="caption wiki-view__error">{error}</p> : null}

        {pageLoading ? (
          <LoaderState label="Loading wiki…" align="fill" />
        ) : instances.length === 0 ? (
          <ViewEmptyState
            layout="panel"
            title={
              wikiEmptyCopy({
                canWrite: canWriteActiveScope,
                hasSpaces: false,
                hasHome: true,
              }).title
            }
            description={
              wikiEmptyCopy({
                canWrite: canWriteActiveScope,
                hasSpaces: false,
                hasHome: true,
              }).description
            }
            primaryAction={
              canWriteActiveScope
                ? {
                    label: "New Space",
                    onClick: () => {
                      void createTab("Wiki");
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className="wiki-view__body">
            <aside
              className={[
                "wiki-view__rail",
                railCollapsed ? "wiki-view__rail--collapsed" : "",
                railResizing ? "wiki-view__rail--resizing" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                width: railCollapsed ? RAIL_COLLAPSED_WIDTH : railWidth,
              }}
            >
              <div className="wiki-view__rail-chrome">
                <IconButton
                  icon={railCollapsed ? PanelLeft : PanelLeftClose}
                  label={railCollapsed ? "Show page tree" : "Hide page tree"}
                  size="small"
                  onClick={toggleRail}
                />
                {!railCollapsed ? (
                  <>
                    <div className="wiki-view__search">
                      <Search size={16} aria-hidden />
                      <input
                        type="search"
                        placeholder="Search by title"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        aria-label="Search wiki pages"
                      />
                    </div>
                    {canWriteActiveScope && rootDocumentId ? (
                      <IconButton
                        icon={Plus}
                        label="Add page"
                        size="small"
                        onClick={() =>
                          startCreate(selectedId ?? rootDocumentId)
                        }
                      />
                    ) : null}
                  </>
                ) : null}
              </div>

              {!railCollapsed ? (
                <div className="wiki-view__tree overlay-scrollbar">
                  {seedingRoot || rootBusy || (loading && !tree) ? (
                    <LoaderState
                      label="Preparing Space home…"
                      size="s"
                      align="fill"
                    />
                  ) : tree ? (
                    <WikiTree
                      root={tree}
                      selectedId={selectedId}
                      canWrite={canWriteActiveScope}
                      filter={filter}
                      onSelect={selectPage}
                      onAddChild={startCreate}
                      onDrop={(dragged, target, position) => {
                        void handleDrop(dragged, target, position);
                      }}
                    />
                  ) : (
                    <div className="wiki-view__empty-block">
                      <p className="caption wiki-view__empty">
                        {canWriteActiveScope
                          ? "Space home isn’t ready yet."
                          : "No Space home yet."}
                      </p>
                      {canWriteActiveScope ? (
                        <IconLabelButton
                          icon={Plus}
                          size="small"
                          onClick={() => {
                            seededRootForInstance.current = null;
                            seedingInFlight.current = false;
                            void createDocument({
                              title: instance?.label?.trim() || "Space home",
                            }).then(async (created) => {
                              if (!created || !instance) return;
                              setPendingRoot({
                                id: created.id,
                                title:
                                  created.title ||
                                  instance.label?.trim() ||
                                  "Space home",
                              });
                              const result = await updateInstance(instance.id, {
                                config: {
                                  ...(instance.config ?? {}),
                                  rootDocumentId: created.id,
                                  defaultTemplateSlug: "blank",
                                },
                                layout: createEmptyWikiLayout(),
                              });
                              if (!result.ok) {
                                showToast(result.error, "error");
                                setPendingRoot(null);
                                return;
                              }
                              seededRootForInstance.current = instance.id;
                              setSelectedId(created.id);
                              await refresh();
                            });
                          }}
                        >
                          Create Space home
                        </IconLabelButton>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
              {!railCollapsed ? (
                <div
                  className="wiki-view__rail-resize"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize page tree"
                  aria-valuemin={RAIL_WIDTH_MIN}
                  aria-valuemax={RAIL_WIDTH_MAX}
                  aria-valuenow={railWidth}
                  tabIndex={0}
                  onPointerDown={startRailResize}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                      return;
                    }
                    event.preventDefault();
                    const delta = event.key === "ArrowRight" ? 16 : -16;
                    const next = clampRailWidth(railWidth + delta);
                    setRailWidth(next);
                    if (workspaceId) {
                      try {
                        window.localStorage.setItem(
                          railWidthStorageKey(workspaceId),
                          String(next),
                        );
                      } catch {
                        // ignore
                      }
                    }
                  }}
                />
              ) : null}
            </aside>

            <section className="wiki-view__center">
              {docPanel.mode !== "pick-template" &&
              (selectedId || seedingRoot) ? (
                <div className="wiki-view__center-chrome">
                  <nav
                    className="wiki-view__breadcrumb"
                    aria-label="Breadcrumb"
                  >
                    {breadcrumbs.length > 0 ? (
                      breadcrumbs.map((crumb, index) => {
                        const last = index === breadcrumbs.length - 1;
                        return (
                          <span key={crumb.id} className="wiki-view__crumb">
                            {index > 0 ? (
                              <span
                                className="wiki-view__crumb-sep"
                                aria-hidden
                              >
                                /
                              </span>
                            ) : null}
                            {last ? (
                              <span
                                className="wiki-view__crumb-current"
                                aria-current="page"
                              >
                                {crumb.title}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="wiki-view__crumb-link"
                                onClick={() => selectPage(crumb.id)}
                              >
                                {crumb.title}
                              </button>
                            )}
                          </span>
                        );
                      })
                    ) : (
                      <span className="wiki-view__crumb-current">
                        {documentTitle.trim() || "Untitled"}
                      </span>
                    )}
                  </nav>
                </div>
              ) : null}

              {docPanel.mode === "pick-template" ? (
                <ViewDocumentPanelHost
                  state={docPanel}
                  placement="fill"
                  onClose={() => {
                    if (selectedId) {
                      setDocPanel({ mode: "editing", documentId: selectedId });
                    } else if (rootDocumentId) {
                      selectPage(rootDocumentId);
                    } else {
                      setDocPanel({ mode: "closed" });
                    }
                  }}
                  onOpenFullPage={(documentId) => openEditor(documentId)}
                  onDocumentCreated={handleDocumentCreated}
                  onDocumentUpdated={() => {
                    void refresh();
                  }}
                />
              ) : selectedId ? (
                <div className="wiki-view__center-editor">
                  <EmbeddedDocumentEditor
                    key={selectedId}
                    documentId={selectedId}
                  />
                </div>
              ) : seedingRoot ? (
                <LoaderState label="Preparing Space home…" align="fill" />
              ) : (
                <div className="wiki-view__center-empty">
                  <p className="caption">
                    Select a page in the tree to edit it.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        {panel === "settings" && instance ? (
          <WikiSettingsPanel
            title={instance.label}
            subtitle={
              typeof instance.config?.subtitle === "string"
                ? instance.config.subtitle
                : config.subtitle ?? ""
            }
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
            onClose={() => setPanel(null)}
          />
        ) : null}
      </div>
    </DocumentsSyncGate>
  );
}
