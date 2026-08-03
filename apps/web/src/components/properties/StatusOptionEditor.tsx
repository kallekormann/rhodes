"use client";

import { useState } from "react";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import {
  fieldKeyFromLabel,
  STATUS_CATEGORIES,
  STATUS_CATEGORY_LABELS,
  type StatusCategory,
  type StatusOption,
} from "@/lib/metadata/schemas";
import "./StatusOptionEditor.css";

type StatusOptionEditorProps = {
  options: StatusOption[];
  onChange: (options: StatusOption[]) => void;
};

const CATEGORY_DROPDOWN_OPTIONS = STATUS_CATEGORIES.map((category) => ({
  id: category,
  label: STATUS_CATEGORY_LABELS[category],
}));

/**
 * Every status option carries a fixed workflow category (mirrors Linear's WorkflowState model)
 * so generic Kanban/progress views can compute "% complete" regardless of custom labels.
 */
export function StatusOptionEditor({ options, onChange }: StatusOptionEditorProps) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftCategory, setDraftCategory] = useState<StatusCategory>("unstarted");

  const addOption = () => {
    const label = draftLabel.trim();
    if (!label) return;
    const value = fieldKeyFromLabel(label);
    if (options.some((option) => option.value === value)) return;
    onChange([...options, { value, label, category: draftCategory }]);
    setDraftLabel("");
    setDraftCategory("unstarted");
  };

  const removeOption = (value: string) => {
    onChange(options.filter((option) => option.value !== value));
  };

  const updateCategory = (value: string, category: StatusCategory) => {
    onChange(
      options.map((option) => (option.value === value ? { ...option, category } : option)),
    );
  };

  return (
    <div className="status-option-editor">
      {options.length > 0 && (
        <ul className="status-option-editor__list">
          {options.map((option) => (
            <li key={option.value} className="status-option-editor__row">
              <span className="status-option-editor__label">{option.label}</span>
              <Dropdown
                variant="plain"
                className="status-option-editor__category"
                value={option.category}
                options={CATEGORY_DROPDOWN_OPTIONS}
                onChange={(value) => updateCategory(option.value, value as StatusCategory)}
              />
              <button
                type="button"
                className="status-option-editor__remove"
                onClick={() => removeOption(option.value)}
                aria-label={`Remove ${option.label}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="status-option-editor__add">
        <Input
          variant="plain"
          value={draftLabel}
          onChange={setDraftLabel}
          placeholder="e.g. In Review"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addOption();
            }
          }}
        />
        <Dropdown
          variant="plain"
          className="status-option-editor__category"
          value={draftCategory}
          options={CATEGORY_DROPDOWN_OPTIONS}
          onChange={(value) => setDraftCategory(value as StatusCategory)}
        />
        <button
          type="button"
          className="tag tag--add"
          onClick={addOption}
          aria-label="Add status"
        >
          +
        </button>
      </div>
    </div>
  );
}
