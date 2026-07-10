import { ArrowUp } from "lucide-react";
import { useId, type KeyboardEvent } from "react";
import "./AskComposer.css";

export type AskComposerStatus = "idle" | "thinking" | "searching";

const statusLabels: Record<Exclude<AskComposerStatus, "idle">, string> = {
  thinking: "Thinking…",
  searching: "Searching…",
};

type AskComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  status?: AskComposerStatus;
  pending?: boolean;
  placeholder?: string;
  className?: string;
};

export function AskComposer({
  value,
  onChange,
  onSend,
  status = "idle",
  pending = false,
  placeholder = "Ask a question…",
  className = "",
}: AskComposerProps) {
  const inputId = useId();
  const canSend = value.trim().length > 0 && !pending;
  const statusLabel = status !== "idle" ? statusLabels[status] : "";

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className={`ask-composer ${className}`.trim()}>
      <textarea
        id={inputId}
        className="ask-composer__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        disabled={pending}
        aria-label="Ask a question"
      />
      <div className="ask-composer__footer">
        <span className="ask-composer__status" aria-live="polite">
          {statusLabel}
        </span>
        <button
          type="button"
          className="ask-composer__send"
          aria-label="Send message"
          disabled={!canSend}
          onClick={onSend}
        >
          <ArrowUp size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
