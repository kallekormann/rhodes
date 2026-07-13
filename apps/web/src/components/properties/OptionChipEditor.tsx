"use client";

import { useState } from "react";
import { Input } from "@/components/Input";
import "./OptionChipEditor.css";

type OptionChipEditorProps = {
  options: string[];
  onChange: (options: string[]) => void;
  placeholder?: string;
};

export function OptionChipEditor({
  options,
  onChange,
  placeholder = "Add option",
}: OptionChipEditorProps) {
  const [draft, setDraft] = useState("");

  const addOption = () => {
    const next = draft.trim();
    if (!next || options.includes(next)) return;
    onChange([...options, next]);
    setDraft("");
  };

  const removeOption = (option: string) => {
    onChange(options.filter((item) => item !== option));
  };

  return (
    <div className="option-chip-editor">
      <div className="option-chip-editor__chips">
        {options.map((option) => (
          <span key={option} className="tag">
            {option.replace(/_/g, " ")}
            <button
              type="button"
              className="option-chip-editor__remove"
              onClick={() => removeOption(option)}
              aria-label={`Remove ${option}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="option-chip-editor__add">
        <Input
          variant="plain"
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addOption();
            }
          }}
        />
        <button type="button" className="tag tag--add" onClick={addOption} aria-label="Add option">
          +
        </button>
      </div>
    </div>
  );
}

export function needsChoiceOptions(fieldType: string) {
  return fieldType === "select" || fieldType === "multi_select" || fieldType === "checkbox";
}
