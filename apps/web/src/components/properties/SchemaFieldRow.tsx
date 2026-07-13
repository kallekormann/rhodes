"use client";

import { useState } from "react";
import { DatePickerField } from "@/components/DatePickerField";
import { DateRangeField, type DateRange } from "@/components/DateRangePicker";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { TextArea } from "@/components/TextArea";
import {
  useBufferedNumberValue,
  useBufferedStringValue,
} from "@/components/properties/useBufferedFieldValue";
import type {
  MetadataDateRange,
  MetadataFieldValue,
  MetadataSchemaField,
} from "@/lib/metadata/schemas";
import { parseSchemaOptions, parseSchemaUnit } from "@/lib/metadata/schemas";

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateValue(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateRangeFromMetadata(range: MetadataDateRange | null): DateRange {
  return {
    start: parseDateValue(range?.start),
    end: parseDateValue(range?.end),
  };
}

function metadataFromDateRange(range: DateRange): MetadataDateRange | null {
  const start = formatDateValue(range.start);
  const end = formatDateValue(range.end);
  if (!start && !end) return null;
  return { start, end };
}

function TagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const next = draft.trim();
    if (!next || tags.includes(next)) return;
    onChange([...tags, next]);
    setDraft("");
  };

  return (
    <div className="props-tags">
      <div className="props-tags__list">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
            <button
              type="button"
              className="props-tags__remove"
              onClick={() => onChange(tags.filter((item) => item !== tag))}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="props-tags__add">
        <Input
          variant="plain"
          value={draft}
          onChange={setDraft}
          placeholder="Add tag"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
        />
        <button type="button" className="tag tag--add" onClick={addTag}>
          +
        </button>
      </div>
    </div>
  );
}

function BufferedTextInput({
  value,
  onChange,
  placeholder,
}: {
  value: MetadataFieldValue;
  onChange: (value: MetadataFieldValue) => void;
  placeholder: string;
}) {
  const externalValue = typeof value === "string" ? value : "";
  const { draft, setDraft, onFocus, onBlur } = useBufferedStringValue(externalValue, (next) =>
    onChange(next || null),
  );

  return (
    <Input
      variant="plain"
      value={draft}
      onChange={setDraft}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
    />
  );
}

function BufferedTextAreaInput({
  value,
  onChange,
  placeholder,
}: {
  value: MetadataFieldValue;
  onChange: (value: MetadataFieldValue) => void;
  placeholder: string;
}) {
  const externalValue = typeof value === "string" ? value : "";
  const { draft, setDraft, onFocus, onBlur } = useBufferedStringValue(externalValue, (next) =>
    onChange(next || null),
  );

  return (
    <TextArea
      className="props-textarea"
      variant="plain"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      rows={4}
      placeholder={placeholder}
    />
  );
}

function BufferedNumberInput({
  value,
  onChange,
  unit,
}: {
  value: MetadataFieldValue;
  onChange: (value: MetadataFieldValue) => void;
  unit: string | null;
}) {
  const externalValue = typeof value === "number" ? value : null;
  const { draft, setDraft, onFocus, onBlur } = useBufferedNumberValue(externalValue, onChange);

  return (
    <dd className="props-list__number">
      <Input
        variant="plain"
        value={draft}
        onChange={setDraft}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="0"
      />
      {unit && <span className="props-list__unit">{unit}</span>}
    </dd>
  );
}

export function SchemaFieldRow({
  field,
  value,
  onChange,
  aiSuggested = false,
  preview = false,
}: {
  field: MetadataSchemaField;
  value: MetadataFieldValue;
  onChange: (value: MetadataFieldValue) => void;
  aiSuggested?: boolean;
  preview?: boolean;
}) {
  const options = parseSchemaOptions(field.options);
  const unit = parseSchemaUnit(field.options);
  const rowClass = ["props-list__row", preview ? "props-list__row--preview" : ""]
    .filter(Boolean)
    .join(" ");
  const label = (
    <>
      {field.field_label}
      {aiSuggested && <span className="props-list__ai-hint">AI suggested</span>}
    </>
  );

  if (field.field_type === "select" && options) {
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          <Dropdown
            variant="plain"
            value={typeof value === "string" ? value : ""}
            options={options.map((option) => ({
              id: option,
              label: option.replace(/_/g, " "),
            }))}
            onChange={(next) => onChange(next || null)}
          />
        </dd>
      </div>
    );
  }

  if (field.field_type === "multi_select" && options) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          <div className="props-multi-select">
            {options.map((option) => {
              const active = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={`tag ${active ? "tag--active" : ""}`}
                  onClick={() => {
                    const next = active
                      ? selected.filter((item) => item !== option)
                      : [...selected, option];
                    onChange(next.length > 0 ? next : null);
                  }}
                >
                  {option.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </dd>
      </div>
    );
  }

  if (field.field_type === "date") {
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          <DatePickerField
            variant="plain"
            value={parseDateValue(typeof value === "string" ? value : null)}
            onChange={(next) => onChange(formatDateValue(next))}
          />
        </dd>
      </div>
    );
  }

  if (field.field_type === "date_range") {
    const range =
      value && typeof value === "object" && !Array.isArray(value)
        ? dateRangeFromMetadata(value as MetadataDateRange)
        : { start: null, end: null };

    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          <DateRangeField
            variant="plain"
            value={range}
            onChange={(next) => onChange(metadataFromDateRange(next))}
          />
        </dd>
      </div>
    );
  }

  if (field.field_type === "textarea") {
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          <BufferedTextAreaInput
            value={value}
            onChange={onChange}
            placeholder={`Add ${field.field_label.toLowerCase()}`}
          />
        </dd>
      </div>
    );
  }

  if (field.field_type === "tags") {
    const tags = Array.isArray(value) ? value : [];
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          <TagsEditor tags={tags} onChange={(next) => onChange(next.length ? next : null)} />
        </dd>
      </div>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          <label className="props-checkbox">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span>{value === true ? "Yes" : "No"}</span>
          </label>
        </dd>
      </div>
    );
  }

  if (field.field_type === "number") {
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <BufferedNumberInput value={value} onChange={onChange} unit={unit} />
      </div>
    );
  }

  return (
    <div className={rowClass}>
      <dt>{label}</dt>
      <dd>
        <BufferedTextInput
          value={value}
          onChange={onChange}
          placeholder={`Add ${field.field_label.toLowerCase()}`}
        />
      </dd>
    </div>
  );
}
