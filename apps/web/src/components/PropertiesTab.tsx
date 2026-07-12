"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { DatePickerField } from "@/components/DatePickerField";
import { DateRangeField, type DateRange } from "@/components/DateRangePicker";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { PropertiesManageSheet } from "@/components/PropertiesManageSheet";
import { TextArea } from "@/components/TextArea";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import type {
  MetadataDateRange,
  MetadataFieldValue,
  MetadataSchemaField,
} from "@/lib/metadata/schemas";
import {
  parseSchemaOptions,
  readMetadataFieldValue,
} from "@/lib/metadata/schemas";
import type { TemplateMetadata } from "@/lib/templates/metadata";
import "./PropertiesTab.css";

type PropertiesTabProps = {
  workspaceId: string | null;
  mode: "document" | "template";
  metadata: Record<string, unknown> | null;
  createdAtLabel?: string | null;
  createdByLabel?: string | null;
  templateDescription?: string | null;
  templateMetadata?: TemplateMetadata;
  onMetadataFieldChange?: (fieldKey: string, value: MetadataFieldValue) => void;
  onTemplateDescriptionChange?: (description: string) => void;
  onTemplateMetadataChange?: (metadata: TemplateMetadata) => void;
};

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

function SchemaFieldRow({
  field,
  value,
  onChange,
  aiSuggested = false,
}: {
  field: MetadataSchemaField;
  value: MetadataFieldValue;
  onChange: (value: MetadataFieldValue) => void;
  aiSuggested?: boolean;
}) {
  const options = parseSchemaOptions(field.options);
  const label = (
    <>
      {field.field_label}
      {aiSuggested && <span className="props-list__ai-hint">AI suggested</span>}
    </>
  );

  if (field.field_type === "select" && options) {
    return (
      <div className="props-list__row">
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
      <div className="props-list__row props-list__row--stacked">
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
      <div className="props-list__row">
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
      <div className="props-list__row">
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
      <div className="props-list__row props-list__row--stacked">
        <dt>{label}</dt>
        <dd>
          <TextArea
            className="props-textarea"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || null)}
            rows={4}
            placeholder={`Add ${field.field_label.toLowerCase()}`}
          />
        </dd>
      </div>
    );
  }

  if (field.field_type === "tags" || field.field_type === "multi_select") {
    const tags = Array.isArray(value) ? value : [];
    return (
      <div className="props-list__row props-list__row--stacked">
        <dt>{label}</dt>
        <dd>
          <TagsEditor tags={tags} onChange={(next) => onChange(next.length ? next : null)} />
        </dd>
      </div>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <div className="props-list__row">
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
      <div className="props-list__row">
        <dt>{label}</dt>
        <dd>
          <Input
            variant="plain"
            value={typeof value === "number" ? String(value) : ""}
            onChange={(next) => onChange(next ? Number(next) : null)}
            placeholder="0"
          />
        </dd>
      </div>
    );
  }

  return (
    <div className="props-list__row">
      <dt>{field.field_label}</dt>
      <dd>
        <Input
          variant="plain"
          value={typeof value === "string" ? value : ""}
          onChange={(next) => onChange(next || null)}
          placeholder={`Add ${field.field_label.toLowerCase()}`}
        />
      </dd>
    </div>
  );
}

function UseCasesEditor({
  useCases,
  onChange,
}: {
  useCases: string[];
  onChange: (useCases: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addUseCase = () => {
    const next = draft.trim();
    if (!next || useCases.includes(next)) return;
    onChange([...useCases, next]);
    setDraft("");
  };

  return (
    <div className="props-list__row props-list__row--stacked">
      <dt>Use cases</dt>
      <dd>
        <ul className="props-use-cases">
          {useCases.map((item) => (
            <li key={item} className="props-use-cases__item">
              <span>{item}</span>
              <button
                type="button"
                className="props-use-cases__remove"
                onClick={() => onChange(useCases.filter((entry) => entry !== item))}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="props-use-cases__add">
          <Input
            variant="plain"
            value={draft}
            onChange={setDraft}
            placeholder="Add use case"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addUseCase();
              }
            }}
          />
          <button type="button" className="tag tag--add" onClick={addUseCase}>
            +
          </button>
        </div>
      </dd>
    </div>
  );
}

export function PropertiesTab({
  workspaceId,
  mode,
  metadata,
  createdAtLabel,
  createdByLabel,
  templateDescription = "",
  templateMetadata,
  onMetadataFieldChange,
  onTemplateDescriptionChange,
  onTemplateMetadataChange,
}: PropertiesTabProps) {
  const {
    schemas,
    loading,
    createSchema,
    deleteSchema,
  } = useMetadataSchemas(workspaceId);
  const [manageOpen, setManageOpen] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const aiFilledKeys = new Set(
    metadata && Array.isArray(metadata._ai_filled_keys)
      ? metadata._ai_filled_keys.filter(
          (key): key is string => typeof key === "string",
        )
      : [],
  );
  const wordCount =
    metadata && typeof metadata.word_count === "number"
      ? metadata.word_count
      : null;

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const debouncedMetadataChange = useCallback(
    (fieldKey: string, value: MetadataFieldValue) => {
      if (!onMetadataFieldChange) return;
      if (debounceTimers.current[fieldKey]) {
        clearTimeout(debounceTimers.current[fieldKey]);
      }
      debounceTimers.current[fieldKey] = setTimeout(() => {
        onMetadataFieldChange(fieldKey, value);
      }, 400);
    },
    [onMetadataFieldChange],
  );

  const defaultProperties = templateMetadata?.default_properties ?? {};

  const handleDefaultPropertyChange = (fieldKey: string, value: MetadataFieldValue) => {
    if (!onTemplateMetadataChange) return;
    const next = { ...defaultProperties };
    if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete next[fieldKey];
    } else if (typeof value === "string") {
      next[fieldKey] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      next[fieldKey] = String(value);
    } else if (Array.isArray(value)) {
      next[fieldKey] = value.join(", ");
    } else if (value.start || value.end) {
      next[fieldKey] = [value.start, value.end].filter(Boolean).join(" → ");
    }
    onTemplateMetadataChange({
      use_cases: templateMetadata?.use_cases ?? [],
      default_properties: next,
    });
  };

  if (loading) {
    return (
      <div className="panel-tab panel-tab--properties">
        <p className="caption">Loading properties…</p>
      </div>
    );
  }

  return (
    <div className="panel-tab panel-tab--properties">
      <div className="panel-tab--properties__scroll overlay-scrollbar">
        <dl className="props-list">
          {mode === "template" && (
            <>
              <div className="props-list__row props-list__row--stacked">
                <dt>Description</dt>
                <dd>
                  <TextArea
                    className="props-textarea"
                    value={templateDescription ?? ""}
                    onChange={(event) =>
                      onTemplateDescriptionChange?.(event.target.value)
                    }
                    rows={4}
                    placeholder="Describe when to use this template"
                  />
                </dd>
              </div>
              <UseCasesEditor
                useCases={templateMetadata?.use_cases ?? []}
                onChange={(useCases) =>
                  onTemplateMetadataChange?.({
                    use_cases: useCases,
                    default_properties: defaultProperties,
                  })
                }
              />
              {schemas.length > 0 && (
                <div className="props-list__section">
                  <h4 className="props-list__section-title">Default properties</h4>
                  {schemas.map((field) => (
                    <SchemaFieldRow
                      key={`default-${field.id}`}
                      field={field}
                      value={defaultProperties[field.field_key] ?? null}
                      onChange={(value) =>
                        handleDefaultPropertyChange(field.field_key, value)
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {mode === "document" && (
            <>
              {createdAtLabel && (
                <div className="props-list__row">
                  <dt>Created</dt>
                  <dd className="props-list__readonly">{createdAtLabel}</dd>
                </div>
              )}
              {createdByLabel && (
                <div className="props-list__row">
                  <dt>Created by</dt>
                  <dd className="props-list__readonly">{createdByLabel}</dd>
                </div>
              )}
              {wordCount !== null && (
                <div className="props-list__row">
                  <dt>Word count</dt>
                  <dd className="props-list__readonly">{wordCount}</dd>
                </div>
              )}
              {schemas.map((field) => (
                <SchemaFieldRow
                  key={field.id}
                  field={field}
                  value={readMetadataFieldValue(metadata, field)}
                  onChange={(value) => debouncedMetadataChange(field.field_key, value)}
                  aiSuggested={aiFilledKeys.has(field.field_key)}
                />
              ))}
              {schemas.length === 0 && (
                <p className="caption">
                  No custom properties yet. Use Manage to add fields for this workspace.
                </p>
              )}
            </>
          )}
        </dl>
      </div>

      {mode === "document" && (
        <div className="properties-tab__actionbar">
          <Button variant="secondary" onClick={() => setManageOpen(true)}>
            Manage
          </Button>
        </div>
      )}

      <PropertiesManageSheet
        open={manageOpen}
        schemas={schemas}
        onClose={() => setManageOpen(false)}
        onCreate={createSchema}
        onDelete={deleteSchema}
      />
    </div>
  );
}
