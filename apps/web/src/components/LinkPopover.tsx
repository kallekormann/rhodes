import { FileText, Link2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./Input";
import { SegmentedControl } from "./SegmentedControl";
import "./LinkPopover.css";

export type LinkMode = "external" | "internal";

type LinkPopoverProps = {
  className?: string;
  workspaceId?: string | null;
  currentDocumentId?: string | null;
  onApply?: (payload: { mode: LinkMode; value: string; label: string }) => void;
  onClose?: () => void;
};

type DocumentLinkItem = {
  id: string;
  title: string;
};

export function LinkPopover({
  className = "",
  workspaceId,
  currentDocumentId,
  onApply,
  onClose,
}: LinkPopoverProps) {
  const [mode, setMode] = useState<LinkMode>("external");
  const [externalUrl, setExternalUrl] = useState("https://");
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<DocumentLinkItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "external") {
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
      return;
    }
    searchInputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (!workspaceId || mode !== "internal") return;

    let cancelled = false;
    setLoadingDocs(true);

    void fetch(
      `/app/api/documents?workspace_id=${encodeURIComponent(workspaceId)}&filter=all`,
    )
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data.documents) ? data.documents : [];
        setDocuments(
          items
            .filter((doc: { id?: string }) => doc.id !== currentDocumentId)
            .map((doc: { id: string; title?: string }) => ({
              id: doc.id,
              title: doc.title?.trim() || "Untitled",
            })),
        );
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDocs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, mode, currentDocumentId]);

  const internalItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const docs = documents.map((doc) => ({
      id: `doc:${doc.id}`,
      label: doc.title,
      group: "Documents" as const,
      icon: FileText,
    }));

    if (!q) return docs;
    return docs.filter((item) => item.label.toLowerCase().includes(q));
  }, [documents, search]);

  const applyExternal = () => {
    const url = externalUrl.trim();
    if (!url || url === "https://") return;
    onApply?.({ mode: "external", value: url, label: url });
    onClose?.();
  };

  return (
    <div
      className={`link-popover ${className}`.trim()}
      role="dialog"
      aria-label="Insert link"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <SegmentedControl
        options={[
          { value: "external", label: "External" },
          { value: "internal", label: "Internal" },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === "external" ? (
        <div className="link-popover__external">
          <Input
            ref={urlInputRef}
            value={externalUrl}
            onChange={setExternalUrl}
            placeholder="https://example.com"
            aria-label="External URL"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyExternal();
              }
            }}
          />
          <button type="button" className="link-popover__apply" onClick={applyExternal}>
            Apply link
          </button>
        </div>
      ) : (
        <div className="link-popover__internal">
          <Input
            ref={searchInputRef}
            value={search}
            onChange={setSearch}
            placeholder="Search documents…"
            icon={<Search size={15} strokeWidth={1.75} />}
            aria-label="Search internal links"
          />
          <div className="link-popover__results">
            {loadingDocs ? (
              <p className="link-popover__empty">Loading documents…</p>
            ) : (
              <>
                <section className="link-popover__group">
                  <header className="link-popover__group-label">Documents</header>
                  {internalItems.length > 0 ? (
                    <ul className="link-popover__list">
                      {internalItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              className="link-popover__item"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                onApply?.({
                                  mode: "internal",
                                  value: item.id,
                                  label: item.label,
                                });
                                onClose?.();
                              }}
                            >
                              <Icon size={15} strokeWidth={1.75} />
                              <span>{item.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="link-popover__empty">No matching documents</p>
                  )}
                </section>
                <section className="link-popover__group">
                  <header className="link-popover__group-label">Library</header>
                  <p className="link-popover__empty link-popover__empty--muted">
                    Library linking arrives with the library feature.
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
