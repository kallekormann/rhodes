import type { ReactNode } from "react";
import "./ChatMessageBubble.css";

export type ChatMessageRole = "user" | "rhodes";

type ChatMessageBubbleProps = {
  role: ChatMessageRole;
  children: ReactNode;
  className?: string;
};

const labels: Record<ChatMessageRole, string> = {
  user: "You",
  rhodes: "Rhodes",
};

export function ChatMessageBubble({
  role,
  children,
  className = "",
}: ChatMessageBubbleProps) {
  return (
    <article className={`chat-bubble chat-bubble--${role} ${className}`.trim()}>
      <span className="chat-bubble__label">{labels[role]}</span>
      <div className="chat-bubble__content">{children}</div>
    </article>
  );
}
