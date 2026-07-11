"use client";

import { MessageSquarePlus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { CommentAnswerComposer } from "@/components/CommentAnswerComposer";
import {
  getCommentReplies,
  getRootComments,
  type StoredDocumentComment,
} from "@/lib/documents/comments";
import "./CommentsTab.css";
import "./CommentAnswerComposer.css";

type CommentsTabProps = {
  comments: StoredDocumentComment[];
  selectedCommentId: string | null;
  hoverCommentId: string | null;
  onSelectComment: (commentId: string) => void;
  onHoverComment: (commentId: string | null) => void;
  onAddReply: (parentId: string, text: string) => void;
  onRemoveComment: (commentId: string) => void;
};

function formatCreatedAt(createdAt: string) {
  const created = new Date(createdAt);
  return Number.isNaN(created.getTime())
    ? createdAt
    : created.toLocaleString();
}

type ThreadMessageProps = {
  comment: StoredDocumentComment;
  emphasized: boolean;
  headerAction?: ReactNode;
  onSelect: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
};

function ThreadMessage({
  comment,
  emphasized,
  headerAction,
  onSelect,
  onHover,
  onHoverEnd,
}: ThreadMessageProps) {
  return (
    <div
      className={`comments-tab__message ${emphasized ? "comments-tab__message--emphasized" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    >
      <header className="comments-tab__message-header">
        <div className="comments-tab__message-identity">
          <span className="comments-tab__message-author">{comment.author}</span>
          <span className="comments-tab__message-date">
            {formatCreatedAt(comment.createdAt)}
          </span>
        </div>
        {headerAction}
      </header>
      <p className="comments-tab__message-text">{comment.text}</p>
    </div>
  );
}

export function CommentsTab({
  comments,
  selectedCommentId,
  hoverCommentId,
  onSelectComment,
  onHoverComment,
  onAddReply,
  onRemoveComment,
}: CommentsTabProps) {
  const selectedRef = useRef<HTMLDivElement | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");

  const rootComments = getRootComments(comments);
  const emphasizedCommentId = selectedCommentId ?? hoverCommentId;

  useEffect(() => {
    if (!selectedCommentId) return;
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedCommentId]);

  const startAnswer = (threadId: string) => {
    setAnsweringId(threadId);
    setAnswerDraft("");
  };

  const cancelAnswer = () => {
    setAnsweringId(null);
    setAnswerDraft("");
  };

  const submitAnswer = (threadId: string) => {
    const text = answerDraft.trim();
    if (!text) return;
    onAddReply(threadId, text);
    cancelAnswer();
  };

  if (rootComments.length === 0) {
    return (
      <div className="comments-tab comments-tab--empty">
        <p className="comments-tab__empty-title">No comments yet</p>
        <p className="comments-tab__empty-hint">
          Select text in the document and use Comment in the bubble menu.
        </p>
      </div>
    );
  }

  return (
    <div className="comments-tab" aria-label="Document comments">
      {rootComments.map((comment) => {
        const replies = getCommentReplies(comments, comment.id);
        const isSelected =
          selectedCommentId === comment.id ||
          replies.some((reply) => reply.id === selectedCommentId);
        const isAnswering = answeringId === comment.id;

        return (
          <article
            key={comment.id}
            ref={isSelected ? selectedRef : undefined}
            className={`comments-tab__card ${isSelected ? "comments-tab__card--selected" : ""}`}
            onMouseLeave={() => onHoverComment(null)}
          >
            <div className="comments-tab__thread">
              <ThreadMessage
                comment={comment}
                emphasized={emphasizedCommentId === comment.id}
                headerAction={
                  <Button
                    type="button"
                    size="small"
                    variant="ghost"
                    className="comments-tab__card-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveComment(comment.id);
                      if (answeringId === comment.id) cancelAnswer();
                    }}
                  >
                    Remove
                  </Button>
                }
                onSelect={() => onSelectComment(comment.id)}
                onHover={() => onHoverComment(comment.id)}
                onHoverEnd={() => onHoverComment(null)}
              />

              {replies.map((reply) => (
                <ThreadMessage
                  key={reply.id}
                  comment={reply}
                  emphasized={emphasizedCommentId === reply.id}
                  onSelect={() => onSelectComment(reply.id)}
                  onHover={() => onHoverComment(reply.id)}
                  onHoverEnd={() => onHoverComment(null)}
                />
              ))}
            </div>

            <div className="comments-tab__card-footer">
              {isAnswering ? (
                <CommentAnswerComposer
                  value={answerDraft}
                  onChange={setAnswerDraft}
                  onCancel={cancelAnswer}
                  onSubmit={() => submitAnswer(comment.id)}
                />
              ) : (
                <Button
                  type="button"
                  size="small"
                  variant="ghost"
                  icon={MessageSquarePlus}
                  className="comments-tab__answer-btn"
                  onClick={() => startAnswer(comment.id)}
                >
                  Answer
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
