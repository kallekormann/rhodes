"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import type { DocumentRecord } from "@/hooks/useDocument";
import { useDocuments } from "@/hooks/useDocuments";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import { useViewInstances } from "@/hooks/useViewInstances";
import { usePublishScopeInstanceLabel } from "@/hooks/usePublishScopeInstanceLabel";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { cacheDocumentTitle } from "@/lib/editor/editor-shell-session";
import { isDocumentArchived } from "@/lib/documents/metadata";
import { isDocumentNativeToScope } from "@/lib/documents/share-context";
import {
  readUserMetadataValue,
  withUserMetadataValue,
  type MetadataSchemaField,
} from "@/lib/metadata/schemas";
import {
  UNSET_COLUMN_ID,
  buildKanbanColumns,
  kanbanConfigFromInstance,
  resolveKanbanGroupField,
  type KanbanColumn,
} from "@/lib/views/kanban";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { Dropdown } from "@/components/Dropdown";
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import { GroupLabel } from "@/components/SectionHeader";
import { UserAvatar } from "@/components/UserAvatar";
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
import "./KanbanView.css";

const KANBAN_GROUP_FIELD_TYPES = new Set(["status", "select"]);

type AuthorInfo = {
  name: string;
  avatarUrl: string | null;
  userId?: string;
};

function KanbanCardBody({
  document,
  author,
}: {
  document: DocumentRecord;
  author: AuthorInfo | null;
}) {
  return (
    <>
      <span className="kanban-card__title">{document.title || "Untitled"}</span>
      {author ? (
        <span className="kanban-card__author">
          <UserAvatar
            name={author.name}
            userId={author.userId}
            src={author.avatarUrl}
            size="sm"
            className="kanban-card__avatar"
          />
          <span className="kanban-card__author-name">{author.name}</span>
        </span>
      ) : null}
    </>
  );
}

function KanbanCard({
  document,
  author,
  onOpen,
}: {
  document: DocumentRecord;
  author: AuthorInfo | null;
  onOpen: (doc: DocumentRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: document.id,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`kanban-card${isDragging ? " kanban-card--dragging" : ""}`}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onOpen(document)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(document);
        }
      }}
    >
      <KanbanCardBody document={document} author={author} />
    </button>
  );
}

function KanbanColumnPane({
  column,
  documents,
  resolveAuthor,
  onOpen,
}: {
  column: KanbanColumn;
  documents: DocumentRecord[];
  resolveAuthor: (doc: DocumentRecord) => AuthorInfo | null;
  onOpen: (doc: DocumentRecord) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((doc) =>
      (doc.title || "Untitled").toLowerCase().includes(needle),
    );
  }, [documents, query]);

  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
  };

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column${isOver ? " kanban-column--over" : ""}`}
      aria-label={column.label}
    >
      <header className="kanban-column__header">
        {searchOpen ? (
          <div className="kanban-column__search">
            <Input
              className="kanban-column__search-input"
              variant="plain"
              value={query}
              onChange={setQuery}
              placeholder={`Search ${column.label}…`}
              autoFocus
              aria-label={`Search ${column.label}`}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeSearch();
                }
              }}
            />
            <IconButton
              icon={X}
              label="Close search"
              size="small"
              iconSize={14}
              onClick={closeSearch}
            />
          </div>
        ) : (
          <>
            <GroupLabel className="kanban-column__title">{column.label}</GroupLabel>
            <div className="kanban-column__header-meta">
              <IconButton
                icon={Search}
                label={`Search ${column.label}`}
                size="small"
                iconSize={14}
                onClick={() => setSearchOpen(true)}
              />
              <span className="kanban-column__count">{documents.length}</span>
            </div>
          </>
        )}
      </header>
      <div className="kanban-column__cards">
        {filtered.map((doc) => (
          <KanbanCard
            key={doc.id}
            document={doc}
            author={resolveAuthor(doc)}
            onOpen={onOpen}
          />
        ))}
        {filtered.length === 0 ? (
          <p className="caption kanban-column__empty">
            {query.trim() ? "No matching cards" : "No cards"}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function KanbanSettingsPanel({
  title,
  subtitle,
  groupFieldKey,
  groupFieldOptions,
  onClose,
  onSave,
  saving,
}: {
  title: string;
  subtitle: string;
  groupFieldKey: string;
  groupFieldOptions: MetadataSchemaField[];
  onClose: () => void;
  onSave: (input: { title: string; subtitle: string; groupFieldKey: string }) => void;
  saving: boolean;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const [draftGroupFieldKey, setDraftGroupFieldKey] = useState(groupFieldKey);

  const selectedGroupLabel = groupFieldOptions.find(
    (field) => field.field_key === draftGroupFieldKey,
  )?.field_label;
  const canSave = draftTitle.trim().length > 0 && draftGroupFieldKey.length > 0;

  return (
    <ViewDockPanel
      title="Board settings"
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
              groupFieldKey: draftGroupFieldKey,
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <ViewSettingsField label="Title">
        <Input value={draftTitle} onChange={setDraftTitle} placeholder="Board title" />
      </ViewSettingsField>

      <ViewSettingsField label="Subtitle">
        <Input
          value={draftSubtitle}
          onChange={setDraftSubtitle}
          placeholder={
            selectedGroupLabel
              ? `Grouped by ${selectedGroupLabel}`
              : "Optional subtitle"
          }
        />
      </ViewSettingsField>

      <ViewSettingsField label="Group columns by">
        {groupFieldOptions.length > 0 ? (
          <Dropdown
            variant="field"
            options={groupFieldOptions.map((field) => ({
              id: field.field_key,
              label: field.field_label,
            }))}
            value={draftGroupFieldKey}
            onChange={setDraftGroupFieldKey}
            placeholder="Choose a property…"
            aria-label="Group columns by"
          />
        ) : (
          <p className="caption view-settings-field__hint">
            Add a status or select property in Settings to power this board.
          </p>
        )}
      </ViewSettingsField>
    </ViewDockPanel>
  );
}

export function KanbanView() {
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
  const { documents, loading, error, updateDocument } = useDocuments(
    workspaceId,
    "all",
    session.userId,
  );
  const { schemas, loading: schemasLoading } = useMetadataSchemas(workspaceId);
  const { members } = useWorkspaceMembers(workspaceId);
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
  } = useViewInstances(workspaceId, "kanban", {
    canWrite: canWriteActiveScope,
    onError: (message) => showToast(message, "error"),
  });

  usePublishScopeInstanceLabel(instance?.label);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  /** Optimistic metadata overrides so cards move instantly on drop. */
  const [optimisticMetadata, setOptimisticMetadata] = useState<
    Map<string, Record<string, unknown>>
  >(() => new Map());

  const config = useMemo(() => kanbanConfigFromInstance(instance), [instance]);
  const groupField = useMemo(
    () => resolveKanbanGroupField(schemas, config),
    [schemas, config],
  );
  const groupFieldOptions = useMemo(
    () => schemas.filter((schema) => KANBAN_GROUP_FIELD_TYPES.has(schema.field_type)),
    [schemas],
  );

  const authorsByUserId = useMemo(() => {
    const map = new Map<string, AuthorInfo>();
    for (const member of members) {
      map.set(member.user_id, {
        name: member.display_name,
        avatarUrl: member.avatar_url,
        userId: member.user_id,
      });
    }
    if (session.userId) {
      map.set(session.userId, {
        name: session.displayName?.trim() || "You",
        avatarUrl: session.avatarUrl,
        userId: session.userId,
      });
    }
    return map;
  }, [members, session.userId, session.displayName, session.avatarUrl]);

  const resolveAuthor = (doc: DocumentRecord): AuthorInfo | null => {
    const userId = doc.created_by;
    if (!userId) return null;
    return (
      authorsByUserId.get(userId) ?? {
        name: "Unknown",
        avatarUrl: null,
        userId,
      }
    );
  };

  useEffect(() => {
    setPanel(null);
  }, [workspaceId, activeInstanceId]);

  useEffect(() => {
    setOptimisticMetadata(new Map());
  }, [workspaceId, activeInstanceId, groupField?.field_key]);

  const boardTitle = instance?.label ?? "Kanban";

  const saveSettings = async (input: {
    title: string;
    subtitle: string;
    groupFieldKey: string;
  }) => {
    setSavingSettings(true);
    const nextConfig = {
      ...(config ?? {}),
      groupByField: input.groupFieldKey,
      ...(input.subtitle ? { subtitle: input.subtitle } : { subtitle: undefined }),
    };
    const result = instance
      ? await updateInstance(instance.id, { label: input.title, config: nextConfig })
      : await createInstance({
          base_view_type: "kanban",
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

  const columns = useMemo(
    () => (groupField ? buildKanbanColumns(groupField) : []),
    [groupField],
  );

  const activeDocs = useMemo(() => {
    const base = documents.filter(
      (doc) => !isDocumentArchived(doc.metadata) && isDocumentNativeToScope(doc),
    );
    if (optimisticMetadata.size === 0) return base;
    return base.map((doc) => {
      const override = optimisticMetadata.get(doc.id);
      if (!override) return doc;
      return { ...doc, metadata: override };
    });
  }, [documents, optimisticMetadata]);

  const docsByColumn = useMemo(() => {
    const map = new Map<string, DocumentRecord[]>();
    for (const column of columns) {
      map.set(column.id, []);
    }
    if (!groupField) return map;

    for (const doc of activeDocs) {
      const raw = readUserMetadataValue(doc.metadata, groupField.field_key);
      const column =
        columns.find((entry) => entry.value === raw) ??
        columns.find((entry) => entry.id === UNSET_COLUMN_ID);
      if (!column) continue;
      map.get(column.id)?.push(doc);
    }
    return map;
  }, [activeDocs, columns, groupField]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const openDoc = (doc: DocumentRecord) => {
    cacheDocumentTitle(doc.id, doc.title);
    setDocumentTitle(doc.title);
    setDocumentId(doc.id);
    openEditor(doc.id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    if (!groupField || !canWriteActiveScope) return;

    const documentId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;

    const targetColumn =
      columns.find((column) => column.id === overId) ??
      columns.find((column) =>
        (docsByColumn.get(column.id) ?? []).some((doc) => doc.id === overId),
      );
    if (!targetColumn) return;

    const doc = activeDocs.find((entry) => entry.id === documentId);
    if (!doc) return;

    const current = readUserMetadataValue(doc.metadata, groupField.field_key);
    const nextValue = targetColumn.value;
    if ((current ?? null) === (nextValue ?? null)) return;

    const nextMetadata = withUserMetadataValue(
      doc.metadata,
      groupField.field_key,
      nextValue,
    );

    // Show the card in the target column immediately; persist in the background.
    setOptimisticMetadata((prev) => {
      const next = new Map(prev);
      next.set(documentId, nextMetadata);
      return next;
    });

    void (async () => {
      const updated = await updateDocument(documentId, { metadata: nextMetadata });
      setOptimisticMetadata((prev) => {
        const next = new Map(prev);
        next.delete(documentId);
        return next;
      });
      if (!updated) {
        showToast("Could not move card", "error");
      }
    })();
  };

  const activeDoc = draggingId
    ? (activeDocs.find((doc) => doc.id === draggingId) ?? null)
    : null;

  const boardLoading =
    scopesPending || loading || schemasLoading || instancesLoading;

  const help = VIEW_HELP_CONTENT.kanban;
  const infoWarnings = !groupField
    ? [
        "Add a status or select property, or choose one in Board settings.",
      ]
    : [];

  return (
    <DocumentsSyncGate>
      <div className="kanban-view">
        <div className="kanban-view__scroll">
          <div className="kanban-view__inner">
            <ViewInstanceTabBar
              className="kanban-view__tabs"
              tabs={instances.map((entry) => ({
                id: entry.id,
                label: entry.label,
              }))}
              activeId={activeInstanceId}
              onSelect={setActiveInstanceId}
              onCreate={(label) => createTab(label)}
              onDelete={(id) => deleteTab(id)}
              canEdit={canWriteActiveScope}
              createTitle="New board"
              deleteNoun="board"
              trailing={
                <ViewHeaderActions
                  panel={panel}
                  onPanelChange={setPanel}
                  canEditSettings={canWriteActiveScope}
                />
              }
            />

            {instancesError ? (
              <p className="caption kanban-view__error">{instancesError}</p>
            ) : null}
            {error ? <p className="caption kanban-view__error">{error}</p> : null}

            {boardLoading ? (
              <LoaderState label="Loading board…" />
            ) : instances.length === 0 ? (
              <p className="caption kanban-view__empty">
                {canWriteActiveScope
                  ? "No boards yet. Use + above to create one — boards are saved with this scope, not recreated on each visit."
                  : "No boards in this view yet."}
              </p>
            ) : !groupField ? (
              <p className="caption kanban-view__empty">
                This scope has no status or select properties yet. Add one in
                Settings, or create documents from a bundle that includes them.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="kanban-view__board-scroll">
                  <div className="kanban-board" role="list">
                    {columns.map((column) => (
                      <KanbanColumnPane
                        key={column.id}
                        column={column}
                        documents={docsByColumn.get(column.id) ?? []}
                        resolveAuthor={resolveAuthor}
                        onOpen={openDoc}
                      />
                    ))}
                  </div>
                </div>
                <DragOverlay dropAnimation={null}>
                  {activeDoc ? (
                    <div className="kanban-card kanban-card--overlay">
                      <KanbanCardBody
                        document={activeDoc}
                        author={resolveAuthor(activeDoc)}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </div>

        {panel === "settings" ? (
          <KanbanSettingsPanel
            title={boardTitle}
            subtitle={config?.subtitle ?? ""}
            groupFieldKey={groupField?.field_key ?? ""}
            groupFieldOptions={groupFieldOptions}
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
