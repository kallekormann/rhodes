"use client";

import { PanelRightClose } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp, type PanelTab } from "@/context/AppContext";
import type { StoredDocumentComment } from "@/lib/documents/comments";
import { AskComposer, type AskComposerStatus } from "./AskComposer";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { CommentsTab } from "./CommentsTab";
import { DatePickerField } from "./DatePickerField";
import { DateRangeField, type DateRange } from "./DateRangePicker";
import { Dropdown } from "./Dropdown";
import { Input } from "./Input";
import { NavLink } from "./NavLink";
import { IconButton } from "./IconButton";
import { TabBar } from "./TabBar";
import "./AskComposer.css";
import "./ChatMessageBubble.css";
import "./RightPanel.css";

const tabOptions: { value: PanelTab; label: string }[] = [
  { value: "insights", label: "Insights" },
  { value: "ask", label: "Ask" },
  { value: "comments", label: "Comments" },
  { value: "properties", label: "Properties" },
];

const statusOptions = [
  { id: "draft", label: "Draft" },
  { id: "progress", label: "In progress" },
  { id: "done", label: "Done" },
];

const ownerOptions = [
  { id: "kalle", label: "Kalle" },
  { id: "team", label: "Growth team" },
  { id: "product", label: "Product" },
  { id: "design", label: "Design" },
  { id: "eng", label: "Engineering" },
];

type ChatMessage = {
  id: string;
  role: "user" | "rhodes";
  text: string;
  rich?: boolean;
};

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    text: "Summarize connections between my Q3 spec and library sources.",
  },
  {
    id: "m2",
    role: "rhodes",
    text: "Based on Reforge Growth.pdf, your ARR targets align with the activation experiments in Post-Experiment Q2.",
    rich: true,
  },
];

type RightPanelProps = {
  comments?: StoredDocumentComment[];
  selectedCommentId?: string | null;
  hoverCommentId?: string | null;
  onSelectComment?: (commentId: string) => void;
  onHoverComment?: (commentId: string | null) => void;
  onAddReply?: (parentId: string, text: string) => void;
  onRemoveComment?: (commentId: string) => void;
};

export function RightPanel({
  comments = [],
  selectedCommentId = null,
  hoverCommentId = null,
  onSelectComment,
  onHoverComment,
  onAddReply,
  onRemoveComment,
}: RightPanelProps) {
  const { panelOpen, panelTab, setPanelTab, closePanel, headerHidden } = useApp();

  return (
    <aside
      className={`right-panel ${panelOpen ? "right-panel--open" : ""} ${!headerHidden ? "right-panel--below-header" : ""}`}
      aria-hidden={!panelOpen}
    >
      <div className="right-panel__header">
        <TabBar
          className="tab-bar--panel"
          options={tabOptions}
          value={panelTab}
          onChange={setPanelTab}
        />
        <IconButton icon={PanelRightClose} label="Close panel" onClick={closePanel} iconSize={18} />
      </div>

      <div className="right-panel__content overlay-scrollbar" key={panelTab}>
        {panelTab === "insights" && <InsightsTab />}
        {panelTab === "ask" && <AskTab />}
        {panelTab === "comments" && (
          <CommentsTab
            comments={comments}
            selectedCommentId={selectedCommentId}
            hoverCommentId={hoverCommentId}
            onSelectComment={onSelectComment ?? (() => {})}
            onHoverComment={onHoverComment ?? (() => {})}
            onAddReply={onAddReply ?? (() => {})}
            onRemoveComment={onRemoveComment ?? (() => {})}
          />
        )}
        {panelTab === "properties" && <PropertiesTab />}
      </div>
    </aside>
  );
}

function InsightsTab() {
  return (
    <div className="panel-tab">
      <article className="insight-card">
        <div className="insight-card__score">94%</div>
        <div>
          <h4 className="insight-card__title">Reforge Growth.pdf</h4>
          <p className="insight-card__reason">
            Why: matches your ARR growth framework and Q3 objectives.
          </p>
        </div>
      </article>
      <hr className="divider" />
      <article className="insight-card">
        <div className="insight-card__score">87%</div>
        <div>
          <h4 className="insight-card__title">Post-Experiment Q2</h4>
          <p className="insight-card__reason">
            Why: references the same activation metrics you discuss here.
          </p>
        </div>
      </article>
    </div>
  );
}

function AskTab() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<AskComposerStatus>("idle");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || pending) return;

    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, role: "user", text }]);
    setDraft("");
    setPending(true);
    setStatus("thinking");

    timersRef.current.push(
      window.setTimeout(() => setStatus("searching"), 1200),
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}-ai`,
            role: "rhodes",
            text: "I found three relevant sources in your library. The strongest match is your Q2 experiment write-up.",
          },
        ]);
        setPending(false);
        setStatus("idle");
      }, 2800),
    );
  };

  return (
    <div className="panel-tab panel-tab--ask">
      <div className="panel-tab__messages">
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} role={message.role}>
            {message.rich ? (
              <p>
                Based on <a href="#">Reforge Growth.pdf</a>, your ARR targets align with the
                activation experiments in Post-Experiment Q2.
              </p>
            ) : (
              <p>{message.text}</p>
            )}
          </ChatMessageBubble>
        ))}
      </div>
      <AskComposer
        className="panel-tab__composer"
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        status={status}
        pending={pending}
      />
    </div>
  );
}

function PropertiesTab() {
  const [status, setStatus] = useState("progress");
  const [owner, setOwner] = useState("kalle");
  const [summary, setSummary] = useState("Q3 activation goals");
  const [due, setDue] = useState<Date | null>(new Date(2026, 10, 10));
  const [range, setRange] = useState<DateRange>({
    start: new Date(2026, 9, 1),
    end: new Date(2026, 11, 15),
  });

  return (
    <div className="panel-tab panel-tab--properties">
      <dl className="props-list">
        <div className="props-list__row">
          <dt>Status</dt>
          <dd>
            <Dropdown
              variant="plain"
              value={status}
              options={statusOptions}
              onChange={setStatus}
            />
          </dd>
        </div>
        <div className="props-list__row">
          <dt>Owner</dt>
          <dd>
            <Dropdown
              variant="plain"
              value={owner}
              options={ownerOptions}
              searchable
              searchPlaceholder="Search people…"
              onChange={setOwner}
            />
          </dd>
        </div>
        <div className="props-list__row">
          <dt>Summary</dt>
          <dd>
            <Input
              variant="plain"
              value={summary}
              onChange={setSummary}
              placeholder="Add summary"
            />
          </dd>
        </div>
        <div className="props-list__row">
          <dt>Due</dt>
          <dd>
            <DatePickerField variant="plain" value={due} onChange={setDue} />
          </dd>
        </div>
        <div className="props-list__row">
          <dt>Timeline</dt>
          <dd>
            <DateRangeField variant="plain" value={range} onChange={setRange} />
          </dd>
        </div>
        <div className="props-list__row">
          <dt>Tags</dt>
          <dd>
            <span className="tag">feature</span>
            <button type="button" className="tag tag--add">
              +
            </button>
          </dd>
        </div>
        <div className="props-list__row">
          <dt>History</dt>
          <dd>
            <NavLink size="small">View versions</NavLink>
          </dd>
        </div>
      </dl>
    </div>
  );
}
