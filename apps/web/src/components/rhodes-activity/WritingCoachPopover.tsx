import type { WritingCoachSuggestion } from "@/hooks/useWritingCoach";
import { Button } from "@/components/Button";
import "./WritingCoachPopover.css";

type WritingCoachPopoverProps = {
  suggestion: WritingCoachSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
};

export function WritingCoachPopover({
  suggestion,
  onAccept,
  onDismiss,
}: WritingCoachPopoverProps) {
  return (
    <div className="writing-coach-popover" role="dialog" aria-label="Rhodes writing suggestion">
      <p className="writing-coach-popover__eyebrow">Rhodes</p>
      <p className="writing-coach-popover__context">{suggestion.contextLabel}</p>
      <p className="writing-coach-popover__feedback">{suggestion.feedback}</p>
      {suggestion.improvedText ? (
        <blockquote className="writing-coach-popover__suggestion">
          {suggestion.improvedText}
        </blockquote>
      ) : null}
      <div className="writing-coach-popover__actions">
        <Button variant="ghost" size="small" onClick={onDismiss}>
          Dismiss
        </Button>
        {suggestion.improvedText ? (
          <Button size="small" onClick={onAccept}>
            Add to document
          </Button>
        ) : null}
      </div>
    </div>
  );
}
