"use client";

import { FileText, Loader, RotateCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { DropZone } from "@/components/DropZone";
import { GroupLabel } from "@/components/SectionHeader";
import { StatusPill } from "@/components/StatusPill";
import { useLibrarySources } from "@/hooks/useLibrarySources";
import {
  embeddingStatusToPill,
  formatLibraryDate,
  formatLibraryFileSize,
} from "@/lib/library/format";
import { isLibraryFileAllowed } from "@/lib/library/schemas";
import "./LibraryView.css";

export function LibraryView() {
  const { workspaceId, showToast } = useApp();
  const { sources, loading, error, uploading, uploadFiles, retrySource } =
    useLibrarySources(workspaceId);

  const handleFilesSelected = async (files: File[]) => {
    const allowed = files.filter(isLibraryFileAllowed);
    const rejected = files.length - allowed.length;

    if (allowed.length === 0) {
      showToast("Only PDF, DOCX, and TXT files are supported", "error");
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

  return (
    <div className="canvas-view library-view">
      <div className="canvas-view__body">
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
            No sources yet. Upload a PDF, DOCX, or TXT to get started.
          </p>
        )}

        <ul className="source-list">
          {sources.map((source) => {
            const pill = embeddingStatusToPill(source.embedding_status);

            return (
              <li key={source.id}>
                <div className="source-row">
                  <FileText size={20} strokeWidth={1.75} className="source-row__icon" />
                  <div className="source-row__main">
                    <span className="source-row__name">{source.file_name}</span>
                    {source.summary && (
                      <p className="source-row__summary">{source.summary}</p>
                    )}
                  </div>
                  <span className="source-row__size">
                    {formatLibraryFileSize(source.metadata?.byte_size)}
                  </span>
                  <StatusPill
                    variant={pill.variant}
                    label={pill.label}
                    icon={
                      source.embedding_status === "pending" ||
                      source.embedding_status === "processing"
                        ? Loader
                        : undefined
                    }
                  />
                  <span className="source-row__date">
                    {formatLibraryDate(source.created_at)}
                  </span>
                  {source.embedding_status === "failed" && (
                    <button
                      type="button"
                      className="source-row__retry"
                      aria-label={`Retry ${source.file_name}`}
                      onClick={() => void handleRetry(source.id, source.file_name)}
                    >
                      <RotateCcw size={16} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
