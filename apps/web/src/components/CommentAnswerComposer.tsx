import { useId, type KeyboardEvent } from "react";
import { Button } from "@/components/Button";
import "./AskComposer.css";
import "./CommentAnswerComposer.css";

type CommentAnswerComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
};

export function CommentAnswerComposer({
  value,
  onChange,
  onCancel,
  onSubmit,
  placeholder = "Write an answer…",
  className = "",
}: CommentAnswerComposerProps) {
  const inputId = useId();
  const canSubmit = value.trim().length > 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  return (
    <div
      className={`ask-composer comment-answer-composer ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
    >
      <textarea
        id={inputId}
        className="ask-composer__input comment-answer-composer__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        aria-label="Answer comment"
      />
      <div className="ask-composer__footer comment-answer-composer__footer">
        <div className="comment-answer-composer__actions">
          <Button type="button" size="small" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="small"
            variant="primary"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            Answer
          </Button>
        </div>
      </div>
    </div>
  );
}
