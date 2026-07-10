import "./CommentMarker.css";

type CommentMarkerProps = {
  count: number;
  active?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
};

export function CommentMarker({
  count,
  active = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className = "",
}: CommentMarkerProps) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      className={`comment-marker ${active ? "comment-marker--active" : ""} ${className}`.trim()}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={`${count} comment${count === 1 ? "" : "s"}`}
    >
      <span className="comment-marker__count">{count}</span>
    </button>
  );
}
