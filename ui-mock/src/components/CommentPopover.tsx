import { useState } from "react";
import { Button } from "./Button";
import { TextArea } from "./TextArea";
import "./CommentPopover.css";

type CommentPopoverProps = {
  className?: string;
  onSave?: (text: string) => void;
  onClose?: () => void;
};

export function CommentPopover({ className = "", onSave, onClose }: CommentPopoverProps) {
  const [draft, setDraft] = useState("");

  return (
    <div className={`comment-popover ${className}`.trim()} role="dialog" aria-label="Add comment">
      <TextArea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a note…"
        rows={3}
      />
      <div className="comment-popover__actions">
        <Button variant="ghost" size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="small"
          disabled={!draft.trim()}
          onClick={() => {
            onSave?.(draft.trim());
            setDraft("");
            onClose?.();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
