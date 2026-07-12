"use client";

import { useState } from "react";
import { FileText, Loader, RotateCcw, Trash2 } from "lucide-react";
import { normalizeLibrarySummary } from "@rhodes/ai";
import { useApp } from "@/context/AppContext";
import { Dialog } from "@/components/Dialog";
import { DropZone } from "@/components/DropZone";
import { GroupLabel } from "@/components/SectionHeader";
import { StatusPill } from "@/components/StatusPill";
import { useLibrarySources } from "@/hooks/useLibrarySources";
import {
  embeddingStatusToPill,
  formatLibraryDate,
  formatLibraryFileSize,
} from "@/lib/library/format";
import { isLibraryFileAllowed, LIBRARY_FILE_ACCEPT, LIBRARY_FILE_LABEL } from "@/lib/library/schemas";
import "./LibraryView.css";

export function LibraryView() {
  const { workspaceId, showToast } = useApp();
  const { sources, loading, error, uploading, uploadFiles, retrySource, deleteSource, deletingIds } =
    useLibrarySources(workspaceId);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    fileName: string;
  } | null>(null);

  const handleFilesSelected = async (files: File[]) => {
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
          <DropZone
            className="library-view__drop"
            disabled={!workspaceId}
            uploading={uploading}
            onFilesSelected={(files) => void handleFilesSelected(files)}
          />

          <GroupLabel>Sources</GroupLabel>

          {loading && sources.length === 0 && (
            <p className="caption library-view__empty">Loading sources…</p>
          )}

          {error && <p className="caption library-view__error">{error}</p>}

          {!loading && sources.length === 0 && !error && (
            <p className="caption library-view__empty">
              No sources yet. Upload a {LIBRARY_FILE_LABEL} file to get started.
            </p>
          )}

          <ul className="source-list">
            {sources.map((source) => {
              const isDeleting = deletingIds.includes(source.id);
              const pill = isDeleting
                ? { variant: "progress" as const, label: "Deleting" }
                : embeddingStatusToPill(source.embedding_status);

              return (
                <li key={source.id}>
                  <div
                    className={`source-row${isDeleting ? " source-row--deleting" : ""}`}
                    aria-busy={isDeleting}
                  >
                    <FileText size={20} strokeWidth={1.75} className="source-row__icon" />
                    <div className="source-row__main">
                      <span className="source-row__name">{source.file_name}</span>
                      {source.embedding_status === "ready" && source.summary && (
                        <p className="source-row__summary">
                          {normalizeLibrarySummary(source.summary)}
                        </p>
                      )}
                    </div>
                    <span className="source-row__size">
                      {formatLibraryFileSize(source.metadata?.byte_size)}
                    </span>
                    <StatusPill
                      variant={pill.variant}
                      label={pill.label}
                      icon={
                        isDeleting ||
                        source.embedding_status === "pending" ||
                        source.embedding_status === "processing"
                          ? Loader
                          : undefined
                      }
                    />
                    <span className="source-row__date">
                      {formatLibraryDate(source.created_at)}
                    </span>
                    {!isDeleting && source.embedding_status === "failed" && (
                      <button
                        type="button"
                        className="source-row__retry"
                        aria-label={`Retry ${source.file_name}`}
                        onClick={() => void handleRetry(source.id, source.file_name)}
                      >
                        <RotateCcw size={16} strokeWidth={1.75} />
                      </button>
                    )}
                    {!isDeleting && source.embedding_status === "pending" && (
                      <button
                        type="button"
                        className="source-row__retry"
                        aria-label={`Reprocess ${source.file_name}`}
                        title="Re-queue indexing"
                        onClick={() => void handleRetry(source.id, source.file_name)}
                      >
                        <RotateCcw size={16} strokeWidth={1.75} />
                      </button>
                    )}
                    {!isDeleting && (
                      <button
                        type="button"
                        className="source-row__remove"
                        aria-label={`Remove ${source.file_name}`}
                        title="Remove from library"
                        onClick={() =>
                          setRemoveTarget({ id: source.id, fileName: source.file_name })
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
