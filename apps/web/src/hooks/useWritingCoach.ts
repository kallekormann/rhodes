"use client";

import { useCallback, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  findCoachableBlock,
  insertRhodesSuggestion,
} from "@/lib/writing-coach/detect";

export type WritingCoachSuggestion = {
  contextLabel: string;
  feedback: string;
  improvedText: string;
  insertAfterPos: number;
  blockId: string | null;
  dismissKey: string;
};

export function useWritingCoach(enabled: boolean) {
  const editorRef = useRef<Editor | null>(null);
  const [suggestion, setSuggestion] = useState<WritingCoachSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dismissedKeysRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);

  const registerEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);

  const evaluateOnBlur = useCallback(async () => {
    const editor = editorRef.current;
    if (!enabled || !editor || inFlightRef.current) return;

    const block = findCoachableBlock(editor);
    if (!block) return;

    const dismissKey = `${block.contextLabel}:${block.text}`;
    if (dismissedKeysRef.current.has(dismissKey)) return;

    inFlightRef.current = true;
    setLoading(true);

    try {
      const response = await fetch("/app/api/writing-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_label: block.contextLabel,
          text: block.text,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;

      if (data.needs_improvement !== true) return;

      const improvedText =
        typeof data.improved_text === "string" ? data.improved_text.trim() : "";
      const feedback =
        typeof data.feedback === "string" ? data.feedback.trim() : "";

      if (!improvedText && !feedback) return;

      setSuggestion({
        contextLabel: block.contextLabel,
        feedback:
          feedback ||
          "I think this could read a little clearer — here's a version you might like.",
        improvedText,
        insertAfterPos: block.insertAfterPos,
        blockId: block.blockId,
        dismissKey,
      });
      setOpen(true);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [enabled]);

  const toggleWriting = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const dismissWriting = useCallback(() => {
    if (suggestion) {
      dismissedKeysRef.current.add(suggestion.dismissKey);
    }
    setOpen(false);
    setSuggestion(null);
  }, [suggestion]);

  const acceptWriting = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !suggestion?.improvedText) return;

    insertRhodesSuggestion(editor, suggestion.insertAfterPos, suggestion.improvedText);
    dismissedKeysRef.current.add(suggestion.dismissKey);
    setOpen(false);
    setSuggestion(null);
  }, [suggestion]);

  return {
    registerEditor,
    evaluateOnBlur,
    suggestion,
    loading,
    open,
    toggleWriting,
    dismissWriting,
    acceptWriting,
  };
}
