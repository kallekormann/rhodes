import type { LucideIcon } from "lucide-react";
import { Image, Minus, Pilcrow, Table } from "lucide-react";
import { filterSlashItems } from "./editorSlash";
import "./SlashMenu.css";

export type SlashMenuItem = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: "blocks" | "insert";
};

export const slashMenuItems: SlashMenuItem[] = [
  { id: "paragraph", label: "New paragraph", hint: "Plain text block", icon: Pilcrow, group: "blocks" },
  { id: "divider", label: "Section divider", hint: "Horizontal rule", icon: Minus, group: "blocks" },
  { id: "table", label: "Table", hint: "3×3 starter table", icon: Table, group: "insert" },
  { id: "image", label: "Image", hint: "Upload or embed", icon: Image, group: "insert" },
];

export type SlashMenuPlacement = "above" | "below";

type SlashMenuProps = {
  query?: string;
  activeIndex?: number;
  placement?: SlashMenuPlacement;
  items?: SlashMenuItem[];
  className?: string;
  onItemClick?: (item: SlashMenuItem, index: number) => void;
};

export function SlashMenu({
  query = "",
  activeIndex = 0,
  placement = "below",
  items,
  className = "",
  onItemClick,
}: SlashMenuProps) {
  const filtered = items ?? filterSlashItems(query);

  const groups = [
    { id: "blocks" as const, label: "Blocks" },
    { id: "insert" as const, label: "Insert" },
  ];

  return (
    <div
      className={`slash-menu slash-menu--${placement} ${className}`.trim()}
      role="listbox"
      aria-label="Slash commands"
    >
      {query && (
        <div className="slash-menu__query" aria-hidden="true">
          /{query}
        </div>
      )}
      <div className="slash-menu__scroll">
        {groups.map((group) => {
          const groupItems = filtered.filter((i) => i.group === group.id);
          if (groupItems.length === 0) return null;
          return (
            <section key={group.id} className="slash-menu__group">
              <header className="slash-menu__group-label">{group.label}</header>
              <ul className="slash-menu__list">
                {groupItems.map((item) => {
                  const globalIndex = filtered.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={globalIndex === activeIndex}
                        className={`slash-menu__item ${globalIndex === activeIndex ? "slash-menu__item--active" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onItemClick?.(item, globalIndex)}
                      >
                        <Icon size={16} strokeWidth={1.75} className="slash-menu__item-icon" />
                        <span className="slash-menu__item-main">
                          <span className="slash-menu__item-label">{item.label}</span>
                          {item.hint && (
                            <span className="slash-menu__item-hint">{item.hint}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <p className="slash-menu__empty">No matching commands — space keeps text</p>
        )}
      </div>
      <footer className="slash-menu__footer caption">
        ↑↓ navigate · ↵ select · esc cancel · space keep text
      </footer>
    </div>
  );
}

export { filterSlashItems };
