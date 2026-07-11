"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DatePickerField } from "@/components/DatePickerField";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { TextArea } from "@/components/TextArea";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";
import {
  parseSchemaOptions,
  readUserMetadataValue,
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
  onMetadataFieldChange?: (fieldKey: string, value: string | null) => void;
  onTemplateDescriptionChange?: (description: string) => void;
  onTemplateMetadataChange?: (metadata: TemplateMetadata) => void;
};

function parseDateValue(value: string | null): Date | null {
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

function SchemaFieldRow({
  field,
  value,
  onChange,
}: {
  field: MetadataSchemaField;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const options = parseSchemaOptions(field.options);

  if (field.field_type === "select" && options) {
    return (
      <div className="props-list__row">
        <dt>{field.field_label}</dt>
        <dd>
          <Dropdown
            variant="plain"
            value={value ?? ""}
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

  if (field.field_type === "date") {
    return (
      <div className="props-list__row">
        <dt>{field.field_label}</dt>
        <dd>
          <DatePickerField
            variant="plain"
            value={parseDateValue(value)}
            onChange={(next) => onChange(formatDateValue(next))}
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
          value={value ?? ""}
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
  const { schemas, loading } = useMetadataSchemas(workspaceId);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const debouncedMetadataChange = useCallback(
    (fieldKey: string, value: string | null) => {
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

  const handleDefaultPropertyChange = (fieldKey: string, value: string | null) => {
    if (!onTemplateMetadataChange) return;
    const next = { ...defaultProperties };
    if (!value) {
      delete next[fieldKey];
    } else {
      next[fieldKey] = value;
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
                    onChange={(value) => handleDefaultPropertyChange(field.field_key, value)}
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
            {schemas.map((field) => (
              <SchemaFieldRow
                key={field.id}
                field={field}
                value={readUserMetadataValue(metadata, field.field_key)}
                onChange={(value) => debouncedMetadataChange(field.field_key, value)}
              />
            ))}
            {schemas.length === 0 && (
              <p className="caption">No custom properties defined for this workspace.</p>
            )}
          </>
        )}
      </dl>
    </div>
  );
}
