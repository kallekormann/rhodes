import type { ReactNode } from "react";
import { NavLink } from "./NavLink";
import "./SectionHeader.css";

type SectionHeaderProps = {
  title: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
};

export function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`section-title ${className}`.trim()}>{children}</h2>;
}

export function GroupLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`group-label ${className}`.trim()}>{children}</h3>;
}

export function SectionHeader({ title, action, children }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <SectionTitle>{title}</SectionTitle>
      {action ? (
        <NavLink size="small" onClick={action.onClick}>
          {action.label}
        </NavLink>
      ) : (
        children
      )}
    </div>
  );
}
