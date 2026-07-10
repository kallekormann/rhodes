import { ChevronDown, Lock, Users } from "lucide-react";
import type { Scope } from "../data/scopes";
import "./ScopeSwitcher.css";

type ScopeTriggerProps = {
  scope: Scope;
  open?: boolean;
  onClick?: () => void;
  className?: string;
};

export function ScopeTrigger({ scope, open = false, onClick, className = "" }: ScopeTriggerProps) {
  return (
    <button
      type="button"
      className={`scope-btn ${className}`.trim()}
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="listbox"
    >
      {scope.type === "private" ? (
        <Lock size={14} strokeWidth={1.75} className="scope-btn__icon" />
      ) : (
        <Users size={14} strokeWidth={1.75} className="scope-btn__icon" />
      )}
      <span>{scope.name}</span>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        className={`scope-btn__chevron ${open ? "scope-btn__chevron--open" : ""}`}
      />
    </button>
  );
}
