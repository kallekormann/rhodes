import type { ReactNode } from "react";
import "./ListRow.css";

type ListRowProps = {
  title: string;
  meta?: string;
  trailing?: ReactNode;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
};

export function ListRow({ title, meta, trailing, badge, active = false, onClick }: ListRowProps) {
  return (
    <li>
      <button
        type="button"
        className={`list-row ${active ? "list-row--active" : ""}`}
        onClick={onClick}
      >
        <div className="list-row__main">
          <span className="list-row__title">{title}</span>
          {meta && <span className="list-row__meta">{meta}</span>}
        </div>
        {badge && <span className="list-row__badge">{badge}</span>}
        {trailing}
      </button>
    </li>
  );
}

export function ItemList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`item-list ${className}`.trim()}>{children}</ul>;
}
