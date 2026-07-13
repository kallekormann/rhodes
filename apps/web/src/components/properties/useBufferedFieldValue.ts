import { useEffect, useRef, useState } from "react";

export function useBufferedStringValue(
  externalValue: string,
  onCommit: (value: string) => void,
) {
  const [draft, setDraft] = useState(externalValue);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(externalValue);
    }
  }, [externalValue]);

  return {
    draft,
    setDraft,
    onFocus: () => {
      isFocusedRef.current = true;
    },
    onBlur: () => {
      isFocusedRef.current = false;
      if (draft !== externalValue) {
        onCommit(draft);
      }
    },
  };
}

export function useBufferedNumberValue(
  externalValue: number | null,
  onCommit: (value: number | null) => void,
) {
  const serialize = (value: number | null) => (value != null ? String(value) : "");
  const [draft, setDraft] = useState(() => serialize(externalValue));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(serialize(externalValue));
    }
  }, [externalValue]);

  return {
    draft,
    setDraft,
    onFocus: () => {
      isFocusedRef.current = true;
    },
    onBlur: () => {
      isFocusedRef.current = false;
      const trimmed = draft.trim();
      const parsed = trimmed ? Number(trimmed) : null;
      const next = parsed != null && !Number.isNaN(parsed) ? parsed : null;
      onCommit(next);
      setDraft(serialize(next));
    },
  };
}
