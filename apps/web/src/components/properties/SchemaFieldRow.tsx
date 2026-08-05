"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { DatePickerField } from "@/components/DatePickerField";
import { DateRangeField, type DateRange } from "@/components/DateRangePicker";
import { Dropdown } from "@/components/Dropdown";
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/Input";
import { Checkbox } from "@/components/Checkbox";
import { NeutralPill } from "@/components/NeutralPill";
import { TextArea } from "@/components/TextArea";
import { RelationFieldEditor } from "@/components/properties/RelationFieldEditor";
import {
  useBufferedNumberValue,
  useBufferedStringValue,
} from "@/components/properties/useBufferedFieldValue";
import type {
  MetadataDateRange,
  MetadataFieldValue,
  MetadataRelationValue,
  MetadataSchemaField,
} from "@/lib/metadata/schemas";
import { parseSchemaOptions, parseStatusOptions, parseSchemaUnit } from "@/lib/metadata/schemas";

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
          <span key={tag} className="props-tags__chip">
            <NeutralPill>{tag}</NeutralPill>
            <IconButton
              icon={X}
              label={`Remove ${tag}`}
              size="small"
              onClick={() => onChange(tags.filter((item) => item !== tag))}
            />
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
        <IconButton icon={Plus} label="Add tag" size="small" onClick={addTag} />
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
  excludeDocumentId = null,
  readOnly = false,
  hint,
}: {
  field: MetadataSchemaField;
  value: MetadataFieldValue;
  onChange: (value: MetadataFieldValue) => void;
  aiSuggested?: boolean;
  preview?: boolean;
  excludeDocumentId?: string | null;
  readOnly?: boolean;
  hint?: string;
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

  if (field.field_type === "status") {
    const statusOptions = parseStatusOptions(field.options);
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          {statusOptions ? (
            <Dropdown
              variant="plain"
              value={typeof value === "string" ? value : ""}
              options={statusOptions.map((option) => ({
                id: option.value,
                label: option.label,
              }))}
              onChange={(next) => onChange(next || null)}
            />
          ) : (
            <span className="props-list__empty-options">
              No statuses — add them in Manage
            </span>
          )}
        </dd>
      </div>
    );
  }

  if (field.field_type === "relation") {
    const relation =
      value && typeof value === "object" && !Array.isArray(value) && "document_id" in value
        ? (value as MetadataRelationValue)
        : null;
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          <RelationFieldEditor
            value={relation}
            onChange={(next) => onChange(next)}
            excludeDocumentId={excludeDocumentId}
            readOnly={readOnly}
            emptyLabel={readOnly ? "Space home" : "None"}
          />
          {hint ? <p className="caption props-list__field-hint">{hint}</p> : null}
        </dd>
      </div>
    );
  }

  if (field.field_type === "select") {
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          {options ? (
            <Dropdown
              variant="plain"
              value={typeof value === "string" ? value : ""}
              options={options.map((option) => ({
                id: option,
                label: option.replace(/_/g, " "),
              }))}
              onChange={(next) => onChange(next || null)}
            />
          ) : (
            <span className="props-list__empty-options">
              No options — add them in Manage
            </span>
          )}
        </dd>
      </div>
    );
  }

  if (field.field_type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className={rowClass}>
        <dt>{label}</dt>
        <dd>
          {options ? (
            <div className="props-multi-select">
              {options.map((option) => {
                const active = selected.includes(option);
                return (
                  <Checkbox
                    key={option}
                    label={option.replace(/_/g, " ")}
                    checked={active}
                    onChange={() => {
                      const next = active
                        ? selected.filter((item) => item !== option)
                        : [...selected, option];
                      onChange(next.length > 0 ? next : null);
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <span className="props-list__empty-options">
              No options — add them in Manage
            </span>
          )}
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
          <Checkbox
            label={value === true ? "Yes" : "No"}
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />
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
