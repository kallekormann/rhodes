"use client";

import {
  File,
  Files,
  Library,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useApp } from "@/context/AppContext";
import { useCmdKSearch } from "@/hooks/useCmdKSearch";
import { openKnowledgeSourcePreview } from "@/lib/library/preview";
import { Input } from "./Input";
import "./CmdKModal.css";

type ActionItem = {
  kind: "action";
  id: string;
  label: string;
  section: "Actions";
  icon: typeof Plus;
  run: () => void;
};

type DocItem = {
  kind: "document";
  id: string;
  label: string;
  section: "Documents" | "Recent";
  icon: typeof File;
};

type LibraryItem = {
  kind: "library";
  id: string;
  label: string;
  section: "Library";
  icon: typeof Library;
};

type PaletteItem = ActionItem | DocItem | LibraryItem;

export function CmdKModal() {
  const {
    cmdKOpen,
    closeCmdK,
    setView,
    openPanel,
    openEditor,
    createNewDocument,
    openLibraryUpload,
    canWriteActiveScope,
    featureGates,
    workspaceId,
    activeScope,
  } = useApp();

  const scopeName = activeScope.name;
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const { query, setQuery, documents, library, loading } = useCmdKSearch(
    workspaceId,
    cmdKOpen,
  );

  useEffect(() => {
    if (!cmdKOpen) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [cmdKOpen]);

  const actions = useMemo((): ActionItem[] => {
    const rows: ActionItem[] = [];
    if (canWriteActiveScope) {
      rows.push({
        kind: "action",
        id: "action-new-doc",
        label: "New document",
        section: "Actions",
        icon: Plus,
        run: () => {
          void createNewDocument();
        },
      });
      if (featureGates.can("library.upload")) {
        rows.push({
          kind: "action",
          id: "action-import",
          label: `Import file into ${scopeName}`,
          section: "Actions",
          icon: Upload,
          run: () => openLibraryUpload(),
        });
      }
    }
    rows.push({
      kind: "action",
      id: "action-documents",
      label: "Open documents",
      section: "Actions",
      icon: Files,
      run: () => setView("documents"),
    });
    if (featureGates.can("ask.chat")) {
      rows.push({
        kind: "action",
        id: "action-ask",
        label: `Ask about ${scopeName}`,
        section: "Actions",
        icon: Sparkles,
        run: () => openPanel("ask"),
      });
    }
    return rows;
  }, [
    canWriteActiveScope,
    createNewDocument,
    featureGates,
    openLibraryUpload,
    openPanel,
    scopeName,
    setView,
  ]);

  const items = useMemo((): PaletteItem[] => {
    const q = query.trim().toLowerCase();
    const filteredActions = q
      ? actions.filter((action) => action.label.toLowerCase().includes(q))
      : actions;

    const docSection = q ? "Documents" : "Recent";
    const docItems: DocItem[] = documents.map((doc) => ({
      kind: "document",
      id: `doc-${doc.id}`,
      label: doc.title,
      section: docSection,
      icon: File,
    }));

    const libraryItems: LibraryItem[] = library.map((source) => ({
      kind: "library",
      id: `lib-${source.id}`,
      label: source.file_name,
      section: "Library",
      icon: Library,
    }));

    if (q) {
      return [...docItems, ...libraryItems, ...filteredActions];
    }
    return [...docItems, ...filteredActions];
  }, [actions, documents, library, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, items.length, cmdKOpen]);

  if (!cmdKOpen) return null;

  const runItem = (item: PaletteItem) => {
    closeCmdK();
    if (item.kind === "action") {
      item.run();
      return;
    }
    if (item.kind === "document") {
      const docId = item.id.replace(/^doc-/, "");
      openEditor(docId);
      return;
    }
    openKnowledgeSourcePreview({
      originType: "library",
      sourceRefId: item.id.replace(/^lib-/, ""),
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCmdK();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (items.length === 0) return;
      setActiveIndex((index) => (index + 1) % items.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      setActiveIndex((index) => (index - 1 + items.length) % items.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) runItem(item);
    }
  };

  let lastSection = "";

  return (
    <div className="cmdk-overlay" onClick={closeCmdK} role="presentation">
      <div
        className="cmdk-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={setQuery}
          onKeyDown={handleKeyDown}
          placeholder="Search documents, library, or type a command…"
          icon={<Search size={18} strokeWidth={1.75} />}
          hint="⌘K"
          aria-controls={listId}
          aria-activedescendant={
            items[activeIndex] ? `${listId}-${items[activeIndex].id}` : undefined
          }
        />
        <ul
          className="cmdk-list"
          id={listId}
          role="listbox"
          aria-label="Search results"
          aria-busy={loading}
        >
          {loading && items.length === 0 && (
            <li className="cmdk-list__empty" role="status">
              Searching…
            </li>
          )}
          {!loading && items.length === 0 && (
            <li className="cmdk-list__empty" role="status">
              No matches
            </li>
          )}
          {items.map((item, index) => {
            const showSection = item.section !== lastSection;
            lastSection = item.section;
            const Icon = item.icon;
            const active = index === activeIndex;
            return (
              <li key={item.id}>
                {showSection && (
                  <div className="cmdk-list__section">{item.section}</div>
                )}
                <button
                  type="button"
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={active}
                  className={`cmdk-list__item${active ? " cmdk-list__item--active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runItem(item)}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span className="cmdk-list__label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
