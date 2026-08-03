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

/** Cross-document reference (Coda-style relation column) — search-and-pick, single value in v1. */
export function RelationFieldEditor({
  value,
  onChange,
}: {
  value: MetadataRelationValue | null;
  onChange: (value: MetadataRelationValue | null) => void;
}) {
  const { workspaceId } = useApp();
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
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        filter: "recent",
        q: query.trim(),
        limit: "8",
      });
      fetch(`/api/documents?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : { documents: [] }))
        .then((data: { documents?: DocumentSearchResult[] }) => {
          if (!cancelled) setResults(Array.isArray(data.documents) ? data.documents : []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open, workspaceId]);

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
