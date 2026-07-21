"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  addPersonalWord,
  ignoreWord,
  suggestWord,
} from "@/lib/spellcheck/engine";
import type { SpellSuggestionPayload } from "@/components/editor/extensions/SpellcheckExtension";
import "./SpellSuggestionPopover.css";

const POPOVER_WIDTH = 220;
const VIEWPORT_PADDING = 8;
const GAP = 6;

type Placement = "above" | "below";

type SpellSuggestionPopoverProps = {
  editor: Editor;
  payload: SpellSuggestionPayload;
  onClose: () => void;
};

function computePosition(
  rect: DOMRect,
  popoverHeight: number,
): { top: number; left: number; placement: Placement } {
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
  const spaceAbove = rect.top - VIEWPORT_PADDING;
  const needed = Math.max(popoverHeight, 48) + GAP;

  const placement: Placement =
    spaceBelow >= needed || spaceBelow >= spaceAbove ? "below" : "above";

  const left = Math.min(
    Math.max(VIEWPORT_PADDING, rect.left),
    window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING,
  );

  // For "above", top is the bottom edge of the popover (CSS translates -100%).
  const top =
    placement === "below"
      ? rect.bottom + GAP
      : Math.max(VIEWPORT_PADDING, rect.top - GAP);

  return { top, left, placement };
}

export function SpellSuggestionPopover({
  editor,
  payload,
  onClose,
}: SpellSuggestionPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState(() =>
    computePosition(payload.clientRect, 120),
  );

  useLayoutEffect(() => {
    const height = rootRef.current?.offsetHeight ?? 120;
    setPosition(computePosition(payload.clientRect, height));
  }, [payload.clientRect, loading, suggestions]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void suggestWord(payload.word).then((next) => {
      if (cancelled) return;
      setSuggestions(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [payload.word]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [onClose]);

  useEffect(() => {
    const { from, to } = payload;
    const onTransaction = () => {
      const docSize = editor.state.doc.content.size;
      if (from >= docSize || to > docSize) {
        onClose();
        return;
      }
      const current = editor.state.doc.textBetween(from, to);
      if (current !== payload.word) onClose();
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor, onClose, payload]);

  const refreshSpellcheck = () => {
    const storage = editor.storage.rhodesSpellcheck as
      | { refresh?: () => void }
      | undefined;
    storage?.refresh?.();
  };

  const replaceWith = (suggestion: string) => {
    const { from, to } = payload;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.insertText(suggestion, from, to);
        return true;
      })
      .run();
    onClose();
  };

  const handleIgnore = () => {
    ignoreWord(payload.word);
    refreshSpellcheck();
    onClose();
  };

  const handleAdd = () => {
    void addPersonalWord(payload.word).then(() => {
      refreshSpellcheck();
      onClose();
    });
  };

  return (
    <div
      ref={rootRef}
      className={`spell-suggestion-popover spell-suggestion-popover--${position.placement}`}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label={`Spelling suggestions for ${payload.word}`}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="spell-suggestion-popover__word">{payload.word}</div>
      <ul className="spell-suggestion-popover__list" role="listbox">
        {loading ? (
          <li className="spell-suggestion-popover__empty">Looking up…</li>
        ) : suggestions.length === 0 ? (
          <li className="spell-suggestion-popover__empty">No suggestions</li>
        ) : (
          suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                className="spell-suggestion-popover__item"
                role="option"
                onClick={() => replaceWith(suggestion)}
              >
                {suggestion}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="spell-suggestion-popover__actions">
        <button
          type="button"
          className="spell-suggestion-popover__action"
          onClick={handleIgnore}
        >
          Ignore
        </button>
        <button
          type="button"
          className="spell-suggestion-popover__action"
          onClick={handleAdd}
        >
          Add to dictionary
        </button>
      </div>
    </div>
  );
}
