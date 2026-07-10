import type { EditorComment } from "../data/editorTypes";
import "./CommentNoteBubble.css";

type CommentNoteBubbleProps = {
  comment: EditorComment;
  emphasized?: boolean;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export function CommentNoteBubble({
  comment,
  emphasized = false,
  className = "",
  onMouseEnter,
  onMouseLeave,
}: CommentNoteBubbleProps) {
  return (
    <article
      className={`comment-note ${emphasized ? "comment-note--emphasized" : ""} ${className}`.trim()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <header className="comment-note__meta">
        <span className="comment-note__author">{comment.author}</span>
        <span className="comment-note__date">{comment.createdAt}</span>
      </header>
      <p className="comment-note__text">{comment.text}</p>
    </article>
  );
}

type CommentThreadProps = {
  comments: EditorComment[];
  hoverCommentId?: string | null;
  onCommentHover?: (id: string | null) => void;
  className?: string;
};

export function CommentThread({
  comments,
  hoverCommentId = null,
  onCommentHover,
  className = "",
}: CommentThreadProps) {
  if (comments.length === 0) return null;

  return (
    <aside className={`comment-thread ${className}`.trim()} aria-label="Comments">
      {comments.map((comment) => (
        <CommentNoteBubble
          key={comment.id}
          comment={comment}
          emphasized={hoverCommentId === comment.id}
          onMouseEnter={() => onCommentHover?.(comment.id)}
          onMouseLeave={() => onCommentHover?.(null)}
        />
      ))}
    </aside>
  );
}
