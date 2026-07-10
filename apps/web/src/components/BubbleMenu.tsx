import {
  Bold,
  Heading,
  Italic,
  Link,
  List,
  ListOrdered,
  MessageSquarePlus,
  Quote,
  Sparkles,
} from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { CommentPopover } from "./CommentPopover";
import { LinkPopover } from "./LinkPopover";
import "./BubbleMenu.css";
import "./CommentPopover.css";
import "./LinkPopover.css";

export type BubbleMenuPlacement = "above" | "below";
export type BubbleActiveMark =
  | "bold"
  | "italic"
  | "link"
  | "quote"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "comment";

type BubbleMenuProps = {
  placement?: BubbleMenuPlacement;
  activeMarks?: BubbleActiveMark[];
  className?: string;
  style?: CSSProperties;
  onAsk?: () => void;
  onLinkApply?: (payload: { mode: "external" | "internal"; value: string; label: string }) => void;
  onCommentSave?: (text: string) => void;
  onMarkClick?: (mark: BubbleActiveMark) => void;
  onLinkToggle?: () => void;
  onLinkClose?: () => void;
  linkOpen?: boolean;
  commentOpen?: boolean;
  onCommentToggle?: () => void;
  onCommentClose?: () => void;
  workspaceId?: string | null;
  currentDocumentId?: string | null;
};

const marks: { id: BubbleActiveMark; icon: typeof Bold; label: string }[] = [
  { id: "bold", icon: Bold, label: "Bold" },
  { id: "italic", icon: Italic, label: "Italic" },
  { id: "bulletList", icon: List, label: "Bullet list" },
  { id: "orderedList", icon: ListOrdered, label: "Numbered list" },
  { id: "link", icon: Link, label: "Link" },
  { id: "comment", icon: MessageSquarePlus, label: "Comment" },
  { id: "quote", icon: Quote, label: "Quote" },
  { id: "heading", icon: Heading, label: "Heading" },
];

export function BubbleMenu({
  placement = "above",
  activeMarks = [],
  className = "",
  style,
  onAsk,
  onLinkApply,
  onCommentSave,
  onMarkClick,
  onLinkToggle,
  onLinkClose,
  linkOpen: linkOpenProp,
  commentOpen: commentOpenProp,
  onCommentToggle,
  onCommentClose,
  workspaceId,
  currentDocumentId,
}: BubbleMenuProps) {
  const active = new Set(activeMarks);
  const [linkOpenState, setLinkOpenState] = useState(false);
  const [commentOpenState, setCommentOpenState] = useState(false);
  const linkOpen = linkOpenProp ?? linkOpenState;
  const commentOpen = commentOpenProp ?? commentOpenState;
  const linkRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`bubble-menu bubble-menu--${placement} ${className}`.trim()}
      style={style}
      role="toolbar"
      aria-label="Text formatting"
    >
      <button type="button" className="bubble-menu__ask" onClick={onAsk}>
        <Sparkles size={16} strokeWidth={1.75} />
        Ask
      </button>
      <span className="bubble-menu__divider" aria-hidden="true" />
      {marks.map(({ id, icon: Icon, label }) => {
        if (id === "link") {
          return (
            <div key={id} className="bubble-menu__link-wrap" ref={linkRef}>
              <button
                type="button"
                className={`bubble-menu__item ${active.has(id) || linkOpen ? "bubble-menu__item--active" : ""}`}
                aria-label={label}
                aria-pressed={active.has(id) || linkOpen}
                aria-expanded={linkOpen}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (onLinkToggle) onLinkToggle();
                  else if (linkOpenProp === undefined) setLinkOpenState((open) => !open);
                }}
              >
                <Icon size={16} strokeWidth={1.75} />
              </button>
              {linkOpen && (
                <LinkPopover
                  workspaceId={workspaceId}
                  currentDocumentId={currentDocumentId}
                  onApply={onLinkApply}
                  onClose={() => onLinkClose?.()}
                />
              )}
            </div>
          );
        }

        if (id === "comment") {
          return (
            <div key={id} className="bubble-menu__link-wrap" ref={commentRef}>
              <button
                type="button"
                className={`bubble-menu__item ${active.has(id) || commentOpen ? "bubble-menu__item--active" : ""}`}
                aria-label={label}
                aria-pressed={active.has(id) || commentOpen}
                aria-expanded={commentOpen}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (commentOpenProp === undefined) {
                    setCommentOpenState((open) => !open);
                  } else {
                    onCommentToggle?.();
                  }
                }}
              >
                <Icon size={16} strokeWidth={1.75} />
              </button>
              {commentOpen && (
                <CommentPopover
                  onSave={onCommentSave}
                  onClose={() => {
                    if (commentOpenProp === undefined) setCommentOpenState(false);
                    else onCommentClose?.();
                  }}
                />
              )}
            </div>
          );
        }

        return (
          <button
            key={id}
            type="button"
            className={`bubble-menu__item ${active.has(id) ? "bubble-menu__item--active" : ""}`}
            aria-label={label}
            aria-pressed={active.has(id)}
            onClick={() => onMarkClick?.(id)}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
