"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/Input";
import { useApp } from "@/context/AppContext";
import type { MetadataRelationValue } from "@/lib/metadata/schemas";
import "./RelationFieldEditor.css";

type DocumentSearchResult = {
  id: string;
  title: string | null;
};

async function searchDocumentsInWorkspace(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<DocumentSearchResult[]> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    filter: "recent",
    q: query,
    limit: String(limit),
  });
  const res = await fetch(`/app/api/documents?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as {
    documents?: DocumentSearchResult[];
  };
  return Array.isArray(data.documents) ? data.documents : [];
}

/** Cross-document reference — search-and-pick, single value. Scope-local, or org-wide when in an org scope. */
export function RelationFieldEditor({
  value,
  onChange,
  excludeDocumentId,
}: {
  value: MetadataRelationValue | null;
  onChange: (value: MetadataRelationValue | null) => void;
  /** Hide the current document from search results. */
  excludeDocumentId?: string | null;
}) {
  const { workspaceId, activeScope, scopes } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !workspaceId || !query.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const orgId = activeScope.orgId;
          const workspaceIds =
            orgId != null
              ? scopes
                  .filter((scope) => scope.orgId === orgId)
                  .map((scope) => scope.id)
              : [workspaceId];

          const uniqueIds = [...new Set(workspaceIds.filter(Boolean))];
          const batches = await Promise.all(
            uniqueIds.map((id) => searchDocumentsInWorkspace(id, query.trim(), 8)),
          );

          const seen = new Set<string>();
          if (excludeDocumentId) seen.add(excludeDocumentId);
          const merged: DocumentSearchResult[] = [];
          for (const batch of batches) {
            for (const doc of batch) {
              if (seen.has(doc.id)) continue;
              seen.add(doc.id);
              merged.push(doc);
              if (merged.length >= 8) break;
            }
            if (merged.length >= 8) break;
          }

          if (!cancelled) setResults(merged);
        } catch {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open, workspaceId, activeScope.orgId, scopes, excludeDocumentId]);

  if (value) {
    return (
      <span className="relation-field-editor__pill">
        {value.title || "Untitled"}
        <button
          type="button"
          className="relation-field-editor__remove"
          onClick={() => onChange(null)}
          aria-label="Remove link"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <div className="relation-field-editor" ref={containerRef}>
      <Input
        variant="plain"
        value={query}
        onChange={(next) => {
          setQuery(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search documents…"
      />
      {open && query.trim() && (
        <div className="relation-field-editor__results">
          {loading && <p className="relation-field-editor__hint">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="relation-field-editor__hint">No matches</p>
          )}
          {!loading &&
            results.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className="relation-field-editor__result"
                onClick={() => {
                  onChange({ document_id: doc.id, title: doc.title ?? "Untitled" });
                  setQuery("");
                  setOpen(false);
                }}
              >
                {doc.title || "Untitled"}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
