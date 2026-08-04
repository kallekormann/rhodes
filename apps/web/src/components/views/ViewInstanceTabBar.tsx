"use client";

import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Dialog } from "@/components/Dialog";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import "./ViewInstanceTabBar.css";

export type ViewInstanceTab = {
  id: string;
  label: string;
};

type ViewInstanceTabBarProps = {
  tabs: ViewInstanceTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (label: string) => void | Promise<unknown>;
  onDelete: (id: string) => void | Promise<unknown>;
  canEdit?: boolean;
  createTitle?: string;
  createPlaceholder?: string;
  deleteNoun?: string;
  /** Renders inside the active tab (e.g. Month/List mode). */
  activeTabAccessory?: ReactNode;
  /** Page controls + settings/info — always visible on the right. */
  trailing?: ReactNode;
  className?: string;
};

export function ViewInstanceTabBar({
  tabs,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  canEdit = true,
  createTitle = "New board",
  createPlaceholder = "Board name",
  deleteNoun = "board",
  activeTabAccessory,
  trailing,
  className = "",
}: ViewInstanceTabBarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(max > 2 && el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
    const frame = requestAnimationFrame(updateScrollState);
    return () => cancelAnimationFrame(frame);
  }, [activeId, tabs, updateScrollState]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => updateScrollState());
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [updateScrollState, tabs.length]);

  const scrollTabs = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(120, el.clientWidth * 0.6), behavior: "smooth" });
  };

  const pendingDelete = tabs.find((tab) => tab.id === pendingDeleteId) ?? null;
  const canDelete = tabs.length > 1;
  const showScrollControls = canScrollLeft || canScrollRight;

  const submitCreate = async () => {
    const label = createLabel.trim();
    if (!label || creating) return;
    setCreating(true);
    try {
      await onCreate(label);
      setCreateOpen(false);
      setCreateLabel("");
    } finally {
      setCreating(false);
    }
  };

  const requestDelete = (id: string) => {
    if (!canDelete) return;
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    if (!id) return;
    const result = await onDelete(id);
    if (
      result &&
      typeof result === "object" &&
      "ok" in result &&
      (result as { ok: boolean }).ok === false
    ) {
      throw new Error("Delete failed");
    }
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
    tabId: string,
  ) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + delta + tabs.length) % tabs.length];
      if (next) onSelect(next.id);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(tabId);
      return;
    }
    if (
      canEdit &&
      canDelete &&
      (event.key === "Delete" || event.key === "Backspace")
    ) {
      event.preventDefault();
      requestDelete(tabId);
    }
  };

  return (
    <>
      <div className={`view-instance-tabbar ${className}`.trim()}>
        <div className="view-instance-tabbar__main">
          {canEdit ? (
            <button
              type="button"
              className="view-instance-tabbar__add"
              aria-label={createTitle}
              title={createTitle}
              onClick={() => {
                setCreateLabel("");
                setCreateOpen(true);
              }}
            >
              <Plus size={16} strokeWidth={1.75} />
            </button>
          ) : null}

          <div className="view-instance-tabbar__tabs" role="tablist">
            <div
              ref={scrollRef}
              className="view-instance-tabbar__scroll"
              onScroll={updateScrollState}
            >
              {tabs.map((tab, index) => {
                const active = tab.id === activeId;
                return (
                  <div
                    key={tab.id}
                    role="tab"
                    tabIndex={0}
                    aria-selected={active}
                    ref={active ? activeRef : undefined}
                    className={`view-instance-tabbar__tab${
                      active ? " view-instance-tabbar__tab--active" : ""
                    }${
                      active && activeTabAccessory
                        ? " view-instance-tabbar__tab--with-accessory"
                        : ""
                    }`}
                    onClick={() => onSelect(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index, tab.id)}
                  >
                    <span className="view-instance-tabbar__label">{tab.label}</span>
                    {active && activeTabAccessory ? (
                      <div
                        className="view-instance-tabbar__accessory"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {activeTabAccessory}
                      </div>
                    ) : null}
                    {canEdit ? (
                      <button
                        type="button"
                        className="view-instance-tabbar__close"
                        aria-label={`Delete ${tab.label}`}
                        title={
                          canDelete
                            ? `Delete ${deleteNoun}`
                            : `Keep at least one ${deleteNoun}`
                        }
                        disabled={!canDelete}
                        onClick={(event) => {
                          event.stopPropagation();
                          requestDelete(tab.id);
                        }}
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {showScrollControls ? (
              <div className="view-instance-tabbar__scroll-controls">
                <button
                  type="button"
                  className="view-instance-tabbar__scroll-btn"
                  aria-label="Previous tabs"
                  disabled={!canScrollLeft}
                  onClick={() => scrollTabs(-1)}
                >
                  <ChevronLeft size={14} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className="view-instance-tabbar__scroll-btn"
                  aria-label="Next tabs"
                  disabled={!canScrollRight}
                  onClick={() => scrollTabs(1)}
                >
                  <ChevronRight size={14} strokeWidth={1.75} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {trailing ? (
          <div className="view-instance-tabbar__trailing">{trailing}</div>
        ) : null}
      </div>

      <Modal
        open={createOpen}
        title={createTitle}
        onClose={() => {
          if (!creating) setCreateOpen(false);
        }}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!createLabel.trim() || creating}
              onClick={() => {
                void submitCreate();
              }}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <Input
          value={createLabel}
          onChange={setCreateLabel}
          placeholder={createPlaceholder}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submitCreate();
            }
          }}
        />
      </Modal>

      <Dialog
        open={Boolean(pendingDelete)}
        title={`Delete ${deleteNoun}?`}
        description={
          pendingDelete
            ? `“${pendingDelete.label}” and its layout and settings will be removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onClose={() => setPendingDeleteId(null)}
      />
    </>
  );
}
