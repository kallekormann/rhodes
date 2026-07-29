import { Building2, ChevronDown, Lock, Users } from "lucide-react";
import type { Scope } from "@/data/scopes";
import type { Organization } from "@/data/organizations";
import {
  isSoloProOrgScope,
  scopeTriggerLabel,
  type ScopePickerPartition,
} from "@/lib/workspaces/scope-picker";
import "./ScopeSwitcher.css";

type ScopeTriggerProps = {
  scope: Scope;
  organizations?: Organization[];
  partition?: ScopePickerPartition;
  open?: boolean;
  onClick?: () => void;
  className?: string;
};

export function ScopeTrigger({
  scope,
  organizations = [],
  partition,
  open = false,
  onClick,
  className = "",
}: ScopeTriggerProps) {
  const label = partition
    ? scopeTriggerLabel(scope, organizations, partition)
    : scope.name;
  const soloOrg = partition ? isSoloProOrgScope(scope, partition) : false;
  const isOrgTeam = Boolean(scope.orgId);

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
      ) : soloOrg || isOrgTeam ? (
        <Building2 size={14} strokeWidth={1.75} className="scope-btn__icon" />
      ) : (
        <Users size={14} strokeWidth={1.75} className="scope-btn__icon" />
      )}
      <span>{label}</span>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        className={`scope-btn__chevron ${open ? "scope-btn__chevron--open" : ""}`}
      />
    </button>
  );
}
