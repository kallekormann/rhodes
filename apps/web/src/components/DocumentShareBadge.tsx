import { shareContextLabel, type DocumentShareContext } from "@/lib/documents/share-context";
import "./DocumentShareBadge.css";

type DocumentShareBadgeProps = {
  context: DocumentShareContext | null | undefined;
  className?: string;
};

export function DocumentShareBadge({ context, className = "" }: DocumentShareBadgeProps) {
  const label = shareContextLabel(context);
  if (!label) return null;

  return (
    <span
      className={`document-share-badge ${className}`.trim()}
      title={`${label.short}: ${label.detail}`}
      tabIndex={0}
    >
      <span className="document-share-badge__short">{label.short}</span>
      <span className="document-share-badge__detail">{label.detail}</span>
    </span>
  );
}
