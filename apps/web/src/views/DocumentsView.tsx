"use client";

import { Archive, ArchiveRestore, Search, Share2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import type { DocumentFilter } from "@/lib/documents/schemas";
import {
  formatCreatedAt,
  formatUpdatedAt,
  getDateGroup,
  sortDateGroups,
} from "@/lib/documents/format";
import {
  isDocumentArchived,
  withArchived,
} from "@/lib/documents/metadata";
import { useDocuments } from "@/hooks/useDocuments";
import { useTemplates } from "@/hooks/useTemplates";
import { pickOverviewTemplates, templateRecordToUi } from "@/lib/templates/map";
import { Dialog } from "@/components/Dialog";
import { Divider } from "@/components/Divider";
import { GroupLabel, SectionHeader } from "@/components/SectionHeader";
import { Input } from "@/components/Input";
import { ItemList, ListRow } from "@/components/ListRow";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SharePopover } from "@/components/SharePopover";
import { StatusPill } from "@/components/StatusPill";
import { TemplateCard, TemplateCardGrid } from "@/components/TemplateCard";
import "./DocumentsView.css";

type DocTab = DocumentFilter;

export function DocumentsView() {
  const {
    scopesLoading,
    workspaceId,
    openEditor,
    setDocumentTitle,
    setDocumentId,
    setView,
    showToast,
  } = useApp();
  const [tab, setTab] = useState<DocTab>("recent");
  const [filter, setFilter] = useState("");
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const {
    documents,
    loading,
    error,
    refresh,
    updateDocument,
    deleteDocument,
    createDocument,
  } = useDocuments(workspaceId, tab);

  const { templates } = useTemplates(workspaceId, "all");
  const overviewTemplates = useMemo(
    () => pickOverviewTemplates(templates).map(templateRecordToUi),
    [templates],
  );

  const filtered = useMemo(
    () =>
      documents.filter((doc) =>
        doc.title.toLowerCase().includes(filter.toLowerCase()),
      ),
    [documents, filter],
  );

  const groups = useMemo(() => {
    const unique = [...new Set(filtered.map((doc) => getDateGroup(doc.updated_at)))];
    return unique.sort(sortDateGroups);
  }, [filtered]);

  const handleArchive = async (docId: string, archived: boolean) => {
    const doc = documents.find((item) => item.id === docId);
    if (!doc) return;
    const updated = await updateDocument(docId, {
      metadata: withArchived(doc.metadata, archived),
    });
    if (updated) {
      showToast(archived ? "Document archived" : "Document restored", "success");
      await refresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteDocument(deleteTarget.id);
    if (ok) showToast("Document deleted", "success");
    setDeleteTarget(null);
  };

  const emptyMessage = (() => {
    if (tab === "favorites") {
      return "No favorite documents yet. Open a document and mark it as Favorite.";
    }
    if (tab === "archive") {
      return "No archived documents.";
    }
    if (tab === "shared") {
      return "No shared documents yet. Open a document and use Share in the editor.";
    }
    return "No documents yet. Use + in the header to create one.";
  })();

  return (
    <div className="canvas-view documents-view">
      <div className="documents-view__scroll overlay-scrollbar">
        <div className="documents-view__inner">
          <section className="documents-section">
            <SectionHeader
              title="Templates"
              action={{ label: "More templates", onClick: () => setView("templates") }}
            />
            <TemplateCardGrid>
              {overviewTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  name={template.name}
                  description={template.shortDescription}
                  onClick={async () => {
                    if (!workspaceId) return;
                    const created = await createDocument({
                      title: template.name,
                      template_id: template.id,
                    });
                    if (!created) {
                      showToast("Couldn't create document from template", "error");
                      return;
                    }
                    setDocumentId(created.id);
                    setDocumentTitle(created.title);
                    openEditor(created.id);
                  }}
                />
              ))}
            </TemplateCardGrid>
          </section>

          <Divider />

          <section className="documents-section">
            <div className="documents-toolbar">
              <Input
                placeholder="Search documents…"
                value={filter}
                onChange={setFilter}
                icon={<Search size={18} strokeWidth={1.75} />}
                className="documents-toolbar__search"
              />
              <div className="documents-toolbar__tabs">
                <SegmentedControl
                  options={[
                    { value: "recent", label: "Recent" },
                    { value: "all", label: "All" },
                    { value: "favorites", label: "Favorites" },
                    { value: "archive", label: "Archive" },
                    { value: "shared", label: "Shared" },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </div>
            </div>

            {loading || scopesLoading ? (
              <p className="documents-empty caption">Loading documents…</p>
            ) : error ? (
              <p className="documents-empty caption">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="documents-empty caption">{emptyMessage}</p>
            ) : (
              groups.map((group) => (
                <div key={group} className="doc-group">
                  <GroupLabel>{group}</GroupLabel>
                  <ItemList>
                    {filtered
                      .filter((doc) => getDateGroup(doc.updated_at) === group)
                      .map((doc) => {
                        const archived = isDocumentArchived(doc.metadata);
                        return (
                          <ListRow
                            key={doc.id}
                            title={doc.title}
                            meta={formatCreatedAt(doc.created_at)}
                            metaSecondary={formatUpdatedAt(doc.updated_at)}
                            trailing={
                              archived ? (
                                <StatusPill variant="draft" label="Archived" />
                              ) : undefined
                            }
                            footer={
                              shareDocId === doc.id ? (
                                <div className="documents-row__share-popover">
                                  <SharePopover
                                    documentId={doc.id}
                                    onClose={() => setShareDocId(null)}
                                  />
                                </div>
                              ) : undefined
                            }
                            actions={
                                <>
                                  <button
                                    type="button"
                                    className="list-row__action"
                                    aria-label="Share document"
                                    aria-expanded={shareDocId === doc.id}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setShareDocId((current) =>
                                        current === doc.id ? null : doc.id,
                                      );
                                    }}
                                  >
                                    <Share2 size={15} strokeWidth={1.75} />
                                  </button>
                                  <button
                                    type="button"
                                    className="list-row__action"
                                    aria-label={
                                      archived ? "Unarchive document" : "Archive document"
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleArchive(doc.id, !archived);
                                    }}
                                  >
                                    {archived ? (
                                      <ArchiveRestore size={15} strokeWidth={1.75} />
                                    ) : (
                                      <Archive size={15} strokeWidth={1.75} />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    className="list-row__action list-row__action--danger"
                                    aria-label="Delete document"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setDeleteTarget({
                                        id: doc.id,
                                        title: doc.title,
                                      });
                                    }}
                                  >
                                    <Trash2 size={15} strokeWidth={1.75} />
                                  </button>
                                </>
                              }
                            onClick={() => {
                              setShareDocId(null);
                              setDocumentId(doc.id);
                              setDocumentTitle(doc.title);
                              openEditor(doc.id);
                            }}
                          />
                        );
                      })}
                  </ItemList>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <Dialog
        open={deleteTarget != null}
        title="Delete document?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
