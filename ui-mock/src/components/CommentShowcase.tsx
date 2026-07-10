import { useState } from "react";
import { initialEditorComments } from "../data/editorTypes";
import { BubbleMenu } from "./BubbleMenu";
import { CommentMarker } from "./CommentMarker";
import { CommentNoteBubble, CommentThread } from "./CommentNoteBubble";
import { CommentPopover } from "./CommentPopover";
import "./BubbleMenu.css";
import "./CommentMarker.css";
import "./CommentNoteBubble.css";
import "./CommentPopover.css";
import "./CommentShowcase.css";

export function CommentShowcase() {
  const [commentOpen, setCommentOpen] = useState(false);
  const [hoverCommentId, setHoverCommentId] = useState<string | null>(null);
  const samples = initialEditorComments;

  return (
    <div className="comment-showcase">
      <div className="comment-showcase__item">
        <span className="comment-showcase__label">Comment popover</span>
        <div className="comment-showcase__popover-wrap">
          <CommentPopover className="comment-popover--static" onSave={() => {}} onClose={() => {}} />
        </div>
      </div>
      <div className="comment-showcase__item">
        <span className="comment-showcase__label">Bubble menu — comment open</span>
        <div className="comment-showcase__bubble-wrap">
          <BubbleMenu
            className="bubble-menu--static"
            commentOpen={commentOpen}
            onCommentToggle={() => setCommentOpen((open) => !open)}
            onCommentSave={() => setCommentOpen(false)}
          />
        </div>
      </div>
      <div className="comment-showcase__item">
        <span className="comment-showcase__label">Marker + thread below</span>
        <div className="comment-showcase__marker-wrap">
          <div className="comment-showcase__row">
            <div className="comment-showcase__gutter" aria-hidden="true" />
            <p className="comment-showcase__paragraph">
              <mark className="editor-body__comment-highlight">Onboarding completion</mark>,{" "}
              <mark className="editor-body__comment-highlight">time-to-value</mark>, and weekly active usage…
            </p>
            <div className="editor-body__comment-rail">
              <CommentMarker count={2} active />
              <CommentThread
                className="comment-thread--aside"
                comments={samples}
                hoverCommentId={hoverCommentId}
                onCommentHover={setHoverCommentId}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="comment-showcase__item">
        <span className="comment-showcase__label">Comment note</span>
        <CommentNoteBubble comment={samples[0]!} />
      </div>
    </div>
  );
}
