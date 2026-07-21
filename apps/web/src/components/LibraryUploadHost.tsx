"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useLibrarySources } from "@/hooks/useLibrarySources";
import {
  isLibraryFileAllowed,
  LIBRARY_FILE_ACCEPT,
  LIBRARY_FILE_LABEL,
} from "@/lib/library/schemas";

/**
 * Hidden file picker owned by AppShell so Cmd+K (and others) can open upload
 * without requiring LibraryView to be mounted.
 */
export function LibraryUploadHost() {
  const {
    workspaceId,
    canWriteActiveScope,
    featureGates,
    libraryUploadNonce,
    showToast,
    setView,
  } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles } = useLibrarySources(workspaceId);
  const canUpload =
    canWriteActiveScope && featureGates.can("library.upload");

  useEffect(() => {
    if (libraryUploadNonce === 0) return;
    if (!canUpload) {
      showToast("You don't have permission to upload files in this scope", "error");
      return;
    }
    setView("library");
    const timer = window.setTimeout(() => {
      inputRef.current?.click();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [libraryUploadNonce, canUpload, setView, showToast]);

  const handleChange = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!canUpload) {
      showToast("You don't have permission to upload files in this scope", "error");
      return;
    }

    const list = Array.from(files);
    const allowed = list.filter(isLibraryFileAllowed);
    const rejected = list.length - allowed.length;

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

  return (
    <input
      ref={inputRef}
      type="file"
      accept={LIBRARY_FILE_ACCEPT}
      multiple
      hidden
      aria-hidden
      tabIndex={-1}
      onChange={(event) => {
        void handleChange(event.target.files);
        event.target.value = "";
      }}
    />
  );
}
