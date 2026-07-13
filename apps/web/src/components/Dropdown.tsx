import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { HorizontalAlign } from "./popoverAlign";
import { Input } from "./Input";
import { FieldPanel, useFieldPanel } from "./FieldControl";
import "./FieldControl.css";
import "./Dropdown.css";

export type DropdownOption = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
};

export type DropdownVariant = "menu" | "field" | "plain";

type DropdownProps = {
  variant?: DropdownVariant;
  options: DropdownOption[];
  value?: string;
  placeholder?: string;
  trigger?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  align?: HorizontalAlign | "auto";
  onChange?: (id: string) => void;
  className?: string;
};

export function Dropdown({
  variant = "menu",
  options,
  value,
  placeholder = "Select…",
  trigger,
  searchable = false,
  searchPlaceholder = "Search…",
  align = "auto",
  onChange,
  className = "",
}: DropdownProps) {
  const {
    open,
    setOpen,
    rootRef,
    panelRef,
    align: computedAlign,
    placement,
    panelCoords,
  } = useFieldPanel();
  const [query, setQuery] = useState("");
  const panelAlign = align === "auto" ? computedAlign : align;

  const selected = options.find((o) => o.id === value);
  const isField = variant === "field" || variant === "plain";

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const pick = (id: string) => {
    onChange?.(id);
    setOpen(false);
    setQuery("");
  };

  const displayLabel = selected?.label ?? trigger ?? placeholder;
  const showPlaceholder = !selected && !trigger;

  const triggerClass = [
    isField ? "field-control" : "dropdown__trigger",
    isField && variant === "plain" ? "field-control--plain" : "",
    isField && open ? "field-control--open" : "",
    showPlaceholder && isField ? "field-control--placeholder" : "",
    open && !isField ? "dropdown__trigger--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`${isField ? "field-root" : "dropdown"} ${variant === "menu" ? "" : "dropdown--full"} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {isField ? (
          <>
            <span className="field-control__value">{displayLabel}</span>
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              className={`field-control__icon ${open ? "dropdown__chevron--open" : ""}`}
            />
          </>
        ) : (
          <>
            <span>{displayLabel}</span>
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              className={`dropdown__chevron ${open ? "dropdown__chevron--open" : ""}`}
            />
          </>
        )}
      </button>

      {open && (
        <FieldPanel
          ref={panelRef}
          align={panelAlign}
          placement={placement}
          coords={panelCoords}
          className={isField ? "" : "dropdown__panel"}
        >
          {searchable && (
            <div className="field-panel__search">
              <Input
                value={query}
                onChange={setQuery}
                placeholder={searchPlaceholder}
                autoFocus
              />
            </div>
          )}
          <ul className="field-panel__list" role="listbox">
            {filtered.length === 0 ? (
              <li className="field-panel__empty">No results</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === opt.id}
                    className={`field-panel__item ${value === opt.id ? "field-panel__item--selected" : ""} ${opt.destructive ? "field-panel__item--danger" : ""}`}
                    disabled={opt.disabled}
                    onClick={() => pick(opt.id)}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                    {value === opt.id && <Check size={14} strokeWidth={1.75} />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </FieldPanel>
      )}
    </div>
  );
}
