import { ChatMessageBubble } from "./ChatMessageBubble";
import "./ChatMessageBubble.css";

export function ChatMessageBubbleShowcase() {
  return (
    <div className="chat-bubble-showcase">
      <div className="chat-bubble-showcase__item">
        <span className="chat-bubble-showcase__label">Conversation thread</span>
        <div className="chat-bubble-showcase--thread">
          <ChatMessageBubble role="user">
            <p>Summarize connections between my Q3 spec and library sources.</p>
          </ChatMessageBubble>
          <ChatMessageBubble role="rhodes">
            <p>
              Based on <a href="#">Reforge Growth.pdf</a>, your ARR targets align with the
              activation experiments in Post-Experiment Q2.
            </p>
          </ChatMessageBubble>
        </div>
      </div>
      <div className="chat-bubble-showcase__item">
        <span className="chat-bubble-showcase__label">You — right aligned</span>
        <div className="chat-bubble-showcase--thread">
          <ChatMessageBubble role="user">
            <p>What changed since our Q2 experiment?</p>
          </ChatMessageBubble>
        </div>
      </div>
      <div className="chat-bubble-showcase__item">
        <span className="chat-bubble-showcase__label">Rhodes — left aligned</span>
        <div className="chat-bubble-showcase--thread">
          <ChatMessageBubble role="rhodes">
            <p>
              I found three relevant sources in your library. The strongest match is your Q2
              experiment write-up.
            </p>
          </ChatMessageBubble>
        </div>
      </div>
    </div>
  );
}
