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
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import type { DocumentRecord } from "@/hooks/useDocument";
import { useDocuments } from "@/hooks/useDocuments";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import { useScopeViewInstances } from "@/hooks/useScopeViewInstances";
import { cacheDocumentTitle } from "@/lib/editor/editor-shell-session";
import { isDocumentArchived } from "@/lib/documents/metadata";
import {
  readUserMetadataValue,
  withUserMetadataValue,
} from "@/lib/metadata/schemas";
import {
  UNSET_COLUMN_ID,
  buildKanbanColumns,
  kanbanConfigFromInstance,
  pickKanbanInstance,
  resolveKanbanGroupField,
  type KanbanColumn,
} from "@/lib/views/kanban";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { LoaderState } from "@/components/Loader";
import { GroupLabel, SectionHeader } from "@/components/SectionHeader";
import "./KanbanView.css";

function KanbanCard({
  document,
  onOpen,
}: {
  document: DocumentRecord;
  onOpen: (doc: DocumentRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: document.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
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
      <span className="kanban-card__title">{document.title || "Untitled"}</span>
    </button>
  );
}

function KanbanColumnPane({
  column,
  documents,
  onOpen,
}: {
  column: KanbanColumn;
  documents: DocumentRecord[];
  onOpen: (doc: DocumentRecord) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column${isOver ? " kanban-column--over" : ""}`}
      aria-label={column.label}
    >
      <header className="kanban-column__header">
        <GroupLabel className="kanban-column__title">{column.label}</GroupLabel>
        <span className="kanban-column__count">{documents.length}</span>
      </header>
      <div className="kanban-column__cards">
        {documents.map((doc) => (
          <KanbanCard key={doc.id} document={doc} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export function KanbanView() {
  const {
    workspaceId,
    scopesLoading,
    openEditor,
    setDocumentTitle,
    setDocumentId,
    canWriteActiveScope,
    showToast,
    session,
  } = useApp();

  const scopesPending = !workspaceId || scopesLoading;
  const { documents, loading, error, updateDocument } = useDocuments(
    workspaceId,
    "all",
    session.userId,
  );
  const { schemas, loading: schemasLoading } = useMetadataSchemas(workspaceId);
  const {
    instances,
    loading: instancesLoading,
    error: instancesError,
  } = useScopeViewInstances(workspaceId);

  const [activeId, setActiveId] = useState<string | null>(null);

  const instance = useMemo(() => pickKanbanInstance(instances), [instances]);
  const config = useMemo(() => kanbanConfigFromInstance(instance), [instance]);
  const groupField = useMemo(
    () => resolveKanbanGroupField(schemas, config),
    [schemas, config],
  );
  const columns = useMemo(
    () => (groupField ? buildKanbanColumns(groupField) : []),
    [groupField],
  );

  const activeDocs = useMemo(
    () => documents.filter((doc) => !isDocumentArchived(doc.metadata)),
    [documents],
  );

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
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
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
    const updated = await updateDocument(documentId, { metadata: nextMetadata });
    if (!updated) {
      showToast("Could not move card", "error");
    }
  };

  const activeDoc = activeId
    ? (activeDocs.find((doc) => doc.id === activeId) ?? null)
    : null;

  const boardLoading =
    scopesPending || loading || schemasLoading || instancesLoading;

  return (
    <DocumentsSyncGate>
      <div className="kanban-view">
        <div className="kanban-view__scroll">
          <div className="kanban-view__inner">
            <div>
              <SectionHeader title={instance?.label ?? "Kanban"} />
              <p className="caption kanban-view__hint">
                {groupField
                  ? `Grouped by ${groupField.field_label}`
                  : "Add a status or select property to power this board."}
              </p>
            </div>

            {instancesError ? (
              <p className="caption kanban-view__error">{instancesError}</p>
            ) : null}
            {error ? <p className="caption kanban-view__error">{error}</p> : null}

            {boardLoading ? (
              <LoaderState label="Loading board…" />
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
                onDragEnd={(event) => {
                  void handleDragEnd(event);
                }}
              >
                <div className="kanban-board" role="list">
                  {columns.map((column) => (
                    <KanbanColumnPane
                      key={column.id}
                      column={column}
                      documents={docsByColumn.get(column.id) ?? []}
                      onOpen={openDoc}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeDoc ? (
                    <div className="kanban-card kanban-card--overlay">
                      <span className="kanban-card__title">
                        {activeDoc.title || "Untitled"}
                      </span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </div>
      </div>
    </DocumentsSyncGate>
  );
}
