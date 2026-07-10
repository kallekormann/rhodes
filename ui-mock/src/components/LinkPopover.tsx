import { FileText, Link2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { documents } from "../data/documents";
import { librarySources } from "../data/librarySources";
import { Input } from "./Input";
import { SegmentedControl } from "./SegmentedControl";
import "./LinkPopover.css";

export type LinkMode = "external" | "internal";

type LinkPopoverProps = {
  className?: string;
  onApply?: (payload: { mode: LinkMode; value: string; label: string }) => void;
  onClose?: () => void;
};

export function LinkPopover({ className = "", onApply, onClose }: LinkPopoverProps) {
  const [mode, setMode] = useState<LinkMode>("external");
  const [externalUrl, setExternalUrl] = useState("https://");
  const [search, setSearch] = useState("");

  const internalItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const docs = documents.map((doc) => ({
      id: `doc:${doc.id}`,
      label: doc.title,
      group: "Documents",
      icon: FileText,
    }));
    const lib = librarySources.map((src) => ({
      id: `lib:${src.id}`,
      label: src.title,
      group: "Library",
      icon: Link2,
    }));
    const all = [...docs, ...lib];
    if (!q) return all;
    return all.filter((item) => item.label.toLowerCase().includes(q));
  }, [search]);

  const groups = ["Documents", "Library"] as const;

  const applyExternal = () => {
    if (!externalUrl.trim()) return;
    onApply?.({ mode: "external", value: externalUrl.trim(), label: externalUrl.trim() });
    onClose?.();
  };

  return (
    <div className={`link-popover ${className}`.trim()} role="dialog" aria-label="Insert link">
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
            value={externalUrl}
            onChange={setExternalUrl}
            placeholder="https://example.com"
            aria-label="External URL"
          />
          <button type="button" className="link-popover__apply" onClick={applyExternal}>
            Apply link
          </button>
        </div>
      ) : (
        <div className="link-popover__internal">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search documents or library…"
            icon={<Search size={15} strokeWidth={1.75} />}
            aria-label="Search internal links"
          />
          <div className="link-popover__results">
            {groups.map((group) => {
              const items = internalItems.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <section key={group} className="link-popover__group">
                  <header className="link-popover__group-label">{group}</header>
                  <ul className="link-popover__list">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="link-popover__item"
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
                </section>
              );
            })}
            {internalItems.length === 0 && (
              <p className="link-popover__empty">No matching documents</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
