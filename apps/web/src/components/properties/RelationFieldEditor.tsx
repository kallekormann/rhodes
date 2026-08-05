"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/Input";
import { NeutralPill } from "@/components/NeutralPill";
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

/**
 * Linked-document control — plain Input search + NeutralPill selection
 * (sticker-sheet primitives; same pattern as Properties fields).
 */
export function RelationFieldEditor({
  value,
  onChange,
  excludeDocumentId,
  readOnly = false,
  emptyLabel = "None",
}: {
  value: MetadataRelationValue | null;
  onChange: (value: MetadataRelationValue | null) => void;
  excludeDocumentId?: string | null;
  /** When true, show the linked doc only — no clear or search. */
  readOnly?: boolean;
  emptyLabel?: string;
}) {
  const { workspaceId, activeScope, scopes } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || readOnly) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, readOnly]);

  useEffect(() => {
    if (!open || !workspaceId || readOnly) {
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
            uniqueIds.map((id) =>
              searchDocumentsInWorkspace(id, query.trim(), 8),
            ),
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
  }, [query, open, workspaceId, activeScope.orgId, scopes, excludeDocumentId, readOnly]);

  if (readOnly) {
    return (
      <div className="relation-field-editor__selected">
        {value ? (
          <NeutralPill>{value.title || "Untitled"}</NeutralPill>
        ) : (
          <span className="relation-field-editor__empty">{emptyLabel}</span>
        )}
      </div>
    );
  }

  if (value) {
    return (
      <div className="relation-field-editor__selected">
        <NeutralPill>{value.title || "Untitled"}</NeutralPill>
        <IconButton
          icon={X}
          label="Remove link"
          size="small"
          onClick={() => onChange(null)}
        />
      </div>
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
        aria-label="Search documents to link"
      />
      {open ? (
        <div className="relation-field-editor__results" role="listbox">
          {loading ? (
            <p className="relation-field-editor__hint">Searching…</p>
          ) : null}
          {!loading && results.length === 0 ? (
            <p className="relation-field-editor__hint">
              {query.trim() ? "No matches" : "Type to search recent documents"}
            </p>
          ) : null}
          {!loading
            ? results.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  role="option"
                  className="relation-field-editor__result"
                  onClick={() => {
                    onChange({
                      document_id: doc.id,
                      title: doc.title ?? "Untitled",
                    });
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {doc.title || "Untitled"}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
