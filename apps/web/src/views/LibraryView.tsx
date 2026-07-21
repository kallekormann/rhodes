"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader, Search, Trash2 } from "lucide-react";
import { normalizeLibrarySummary } from "@rhodes/ai";
import {
  libraryFailureOffersReplace,
} from "@rhodes/shared/library-failure";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import {
  DateRangeField,
  type DateRange,
} from "@/components/DateRangePicker";
import { DropZone } from "@/components/DropZone";
import { Dropdown } from "@/components/Dropdown";
import { GroupLabel } from "@/components/SectionHeader";
import { Input } from "@/components/Input";
import { PaginationBar } from "@/components/PaginationBar";
import { StatusPill } from "@/components/StatusPill";
import {
  LIBRARY_PAGE_SIZE,
  useLibrarySources,
} from "@/hooks/useLibrarySources";
import {
  formatLibraryDate,
  formatLibraryFileSize,
} from "@/lib/library/format";
import {
  librarySourceFailureCta,
  librarySourceIsInFlight,
  librarySourceStatusToPill,
  readLibraryFailureCode,
  readLibraryFailureMessage,
} from "@/lib/library/pipeline";
import {
  isLibraryFileAllowed,
  LIBRARY_FILE_ACCEPT,
  LIBRARY_FILE_LABEL,
  type LibraryFileTypeFilter,
} from "@/lib/library/schemas";
import "./LibraryView.css";

const FILE_TYPE_OPTIONS = [
  { id: "all", label: "All types" },
  { id: "pdf", label: "PDF" },
  { id: "docx", label: "DOCX" },
  { id: "ppt", label: "PPT" },
  { id: "xls", label: "XLS" },
  { id: "txt", label: "TXT" },
  { id: "md", label: "Markdown" },
  { id: "rtf", label: "RTF" },
];

function toDateInput(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateParam(value: Date | null): string | null {
  if (!value) return null;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function LibraryView() {
  const {
    workspaceId,
    showToast,
    canWriteActiveScope,
    featureGates,
  } = useApp();
  const canUpload =
    canWriteActiveScope && featureGates.can("library.upload");
  const {
    sources,
    total,
    loading,
    error,
    uploading,
    query,
    setFilters,
    goToOffset,
    uploadFiles,
    replaceSource,
    retrySource,
    deleteSource,
    deletingIds,
  } = useLibrarySources(workspaceId);

  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetRef = useRef<{ id: string; fileName: string } | null>(null);

  useEffect(() => {
    setSearchDraft(query.q);
  }, [query.q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDraft === query.q) return;
      setFilters({ q: searchDraft });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchDraft, query.q, setFilters]);

  const dateRange: DateRange = {
    start: toDateInput(query.from),
    end: toDateInput(query.to),
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!canUpload) {
      showToast("You don't have permission to upload files in this scope", "error");
      return;
    }

    const allowed = files.filter(isLibraryFileAllowed);
    const rejected = files.length - allowed.length;

    if (allowed.length === 0) {
      showToast(`Only ${LIBRARY_FILE_LABEL} files are supported`, "error");
      return;
    }

    if (rejected > 0) {
      showToast("Some files were skipped (unsupported type)", "info");
    }

    showToast(
      allowed.length === 1 ? "Uploading file…" : `Uploading ${allowed.length} files…`,
      "info",
    );

    const result = await uploadFiles(allowed);
    if (result.ok) {
      showToast("Upload complete — indexing started", "success");
    } else if ("error" in result) {
      showToast(result.error ?? "Upload failed", "error");
    }
  };

  const handleRetry = async (sourceId: string, fileName: string) => {
    const result = await retrySource(sourceId);
    if (result.ok) {
      showToast(`Retrying ${fileName}`, "success");
    } else if ("error" in result) {
      showToast(result.error ?? "Retry failed", "error");
    }
  };

  const openReplacePicker = (sourceId: string, fileName: string) => {
    replaceTargetRef.current = { id: sourceId, fileName };
    replaceInputRef.current?.click();
  };

  const handleReplacePicked = async (files: FileList | null) => {
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!target || !files?.length) return;

    const file = files[0];
    if (!isLibraryFileAllowed(file)) {
      showToast(`Only ${LIBRARY_FILE_LABEL} files are supported`, "error");
      return;
    }

    showToast("Replacing file…", "info");
    const result = await replaceSource(target.id, file);
    if (result.ok) {
      showToast("Replaced — indexing started", "success");
    } else if ("error" in result) {
      showToast(result.error ?? "Replace failed", "error");
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const { id, fileName } = removeTarget;
    setRemoveTarget(null);
    const result = await deleteSource(id);
    if (result.ok) {
      showToast(`Removed ${fileName}`, "success");
    } else if ("error" in result) {
      showToast(result.error ?? "Remove failed", "error");
    }
  };

  return (
    <div className="canvas-view library-view">
      <div className="library-view__scroll overlay-scrollbar">
        <div className="library-view__inner">
          {canUpload ? (
            <DropZone
              className="library-view__drop"
              disabled={!workspaceId}
              uploading={uploading}
              onFilesSelected={(files) => void handleFilesSelected(files)}
            />
          ) : (
            <p className="caption library-view__empty">
              You have read-only access in this scope — library uploads are disabled.
            </p>
          )}

          <GroupLabel>Sources</GroupLabel>

          <div className="library-toolbar">
            <Input
              placeholder="Search library…"
              value={searchDraft}
              onChange={setSearchDraft}
              icon={<Search size={18} strokeWidth={1.75} />}
              className="library-toolbar__search"
            />
            <div className="library-toolbar__filters">
              <Dropdown
                variant="plain"
                options={FILE_TYPE_OPTIONS}
                value={query.fileType}
                placeholder="All types"
                onChange={(id) =>
                  setFilters({ fileType: id as LibraryFileTypeFilter })
                }
                className="library-toolbar__type"
              />
              <DateRangeField
                variant="plain"
                value={dateRange}
                placeholder="Date range"
                className="library-toolbar__dates"
                onChange={(range) =>
                  setFilters({
                    from: toDateParam(range.start),
                    to: toDateParam(range.end),
                  })
                }
              />
            </div>
          </div>

          <input
            ref={replaceInputRef}
            type="file"
            accept={LIBRARY_FILE_ACCEPT}
            className="library-view__hidden-input"
            onChange={(event) => {
              void handleReplacePicked(event.target.files);
              event.target.value = "";
            }}
          />

          {loading && sources.length === 0 && (
            <p className="caption library-view__empty">Loading sources…</p>
          )}

          {error && <p className="caption library-view__error">{error}</p>}

          {!loading && sources.length === 0 && !error && (
            <p className="caption library-view__empty">
              {query.q || query.fileType !== "all" || query.from || query.to
                ? "No sources match these filters."
                : `No sources yet. Upload a ${LIBRARY_FILE_LABEL} file to get started.`}
            </p>
          )}

          {sources.length > 0 && (
            <ul className="source-list">
              {sources.map((source) => {
                const isDeleting = deletingIds.includes(source.id);
                const pill = isDeleting
                  ? { variant: "progress" as const, label: "Deleting" }
                  : librarySourceStatusToPill(source);
                const inFlight = librarySourceIsInFlight(source);
                const failureCode = readLibraryFailureCode(source.metadata ?? null);
                const failureMessage = readLibraryFailureMessage(
                  source.metadata ?? null,
                );
                const isFailed = source.embedding_status === "failed";
                const primaryAction = isFailed
                  ? librarySourceFailureCta(source)
                  : null;
                const showSecondaryReplace =
                  isFailed &&
                  primaryAction?.action === "retry" &&
                  libraryFailureOffersReplace(failureCode);

                return (
                  <li key={source.id}>
                    <div
                      className={`source-row${isDeleting ? " source-row--deleting" : ""}${isFailed ? " source-row--failed" : ""}`}
                      aria-busy={isDeleting}
                    >
                      <FileText
                        size={20}
                        strokeWidth={1.75}
                        className="source-row__icon"
                      />
                      <div className="source-row__main">
                        <span className="source-row__name">{source.file_name}</span>
                        {isFailed && (
                          <p className="source-row__failure">
                            {failureMessage ??
                              "Indexing failed unexpectedly."}
                          </p>
                        )}
                        {source.embedding_status === "ready" && source.summary && (
                          <p className="source-row__summary">
                            {normalizeLibrarySummary(source.summary)}
                          </p>
                        )}
                        {canUpload && !isDeleting && isFailed && primaryAction && (
                          <div className="source-row__actions">
                            {primaryAction.action === "replace" ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={() =>
                                  openReplacePicker(source.id, source.file_name)
                                }
                              >
                                {primaryAction.label}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={() =>
                                  void handleRetry(source.id, source.file_name)
                                }
                              >
                                {primaryAction.label}
                              </Button>
                            )}
                            {showSecondaryReplace ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={() =>
                                  openReplacePicker(source.id, source.file_name)
                                }
                              >
                                Replace file
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <span className="source-row__size">
                        {formatLibraryFileSize(source.metadata?.byte_size)}
                      </span>
                      <StatusPill
                        variant={pill.variant}
                        label={pill.label}
                        icon={isDeleting || inFlight ? Loader : undefined}
                      />
                      <span className="source-row__date">
                        {formatLibraryDate(source.created_at)}
                      </span>
                      {!canUpload ? null : !isDeleting &&
                        source.embedding_status === "pending" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="small"
                            className="source-row__requeue"
                            onClick={() =>
                              void handleRetry(source.id, source.file_name)
                            }
                          >
                            Re-queue
                          </Button>
                        )}
                      {!canUpload ? null : !isDeleting && (
                        <button
                          type="button"
                          className="source-row__remove"
                          aria-label={`Remove ${source.file_name}`}
                          title="Remove from library"
                          onClick={() =>
                            setRemoveTarget({
                              id: source.id,
                              fileName: source.file_name,
                            })
                          }
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {total > LIBRARY_PAGE_SIZE && (
            <PaginationBar
              offset={query.offset}
              limit={LIBRARY_PAGE_SIZE}
              total={total}
              onPrevious={() =>
                goToOffset(Math.max(0, query.offset - LIBRARY_PAGE_SIZE))
              }
              onNext={() => goToOffset(query.offset + LIBRARY_PAGE_SIZE)}
            />
          )}
        </div>
      </div>

      <Dialog
        open={removeTarget != null}
        title="Remove source?"
        description={
          removeTarget
            ? `“${removeTarget.fileName}” will be removed from the library, including its file, embeddings, and summary. This cannot be undone.`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void handleRemove()}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  );
}
