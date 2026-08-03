"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Button } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { PanelActionBar } from "@/components/PanelActionBar";
import { Toggle } from "@/components/Toggle";
import { needsChoiceOptions, OptionChipEditor } from "@/components/properties/OptionChipEditor";
import { PropertyFieldPreview } from "@/components/properties/PropertyFieldPreview";
import { StatusOptionEditor } from "@/components/properties/StatusOptionEditor";
import {
  fieldKeyFromLabel,
  METADATA_FIELD_TYPE_LABELS,
  parseSchemaOptions,
  parseSchemaUnit,
  parseStatusOptions,
  schemaOptionsWithUnit,
  type MetadataFieldType,
  type MetadataSchemaField,
  type MetadataSchemaGroup,
  type StatusOption,
} from "@/lib/metadata/schemas";
import { PROPERTY_PRESETS } from "@/lib/metadata/presets";
import "./property-composer.css";

export type PropertyComposerSaveResult =
  | { ok: true }
  | { ok: false; error: string };

const FIELD_TYPE_OPTIONS: MetadataFieldType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "multi_select",
  "status",
  "date",
  "date_range",
  "tags",
  "url",
  "checkbox",
  "relation",
];

export type PropertyFieldComposerHandle = {
  save: () => Promise<PropertyComposerSaveResult>;
};

type PropertyFieldComposerProps = {
  initialPresetLabel?: string | null;
  initialField?: MetadataSchemaField | null;
  hideFooter?: boolean;
  onCancel: () => void;
  onCreate: (input: {
    field_label: string;
    field_type: MetadataFieldType;
    options?: string[] | StatusOption[] | { unit: string };
    ai_fill_enabled?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdate?: (
    schemaId: string,
    input: {
      field_label: string;
      field_type: MetadataFieldType;
      options?: string[] | StatusOption[] | { unit: string };
      ai_fill_enabled?: boolean;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
};

function initialFromField(field: MetadataSchemaField) {
  return {
    label: field.field_label,
    fieldType: field.field_type,
    options: parseSchemaOptions(field.options) ?? [],
    statusOptions: parseStatusOptions(field.options) ?? [],
    unit: parseSchemaUnit(field.options) ?? "",
    aiFillEnabled: field.ai_fill_enabled ?? false,
  };
}

function initialFromPreset(presetLabel: string | null | undefined) {
  const preset = presetLabel
    ? PROPERTY_PRESETS.find((item) => item.label === presetLabel)
    : null;

  return {
    label: preset?.label ?? "",
    fieldType: preset?.field_type ?? ("text" as MetadataFieldType),
    options: preset?.options ?? [],
    statusOptions: [] as StatusOption[],
    unit: "",
    aiFillEnabled: preset?.ai_fill_enabled ?? false,
  };
}

export const PropertyFieldComposer = forwardRef<
  PropertyFieldComposerHandle,
  PropertyFieldComposerProps
>(function PropertyFieldComposer(
  { initialPresetLabel, initialField = null, hideFooter = false, onCancel, onCreate, onUpdate },
  ref,
) {
  const initial = initialField
    ? initialFromField(initialField)
    : initialFromPreset(initialPresetLabel);
  const editingSchemaId = initialField?.id ?? null;
  const [label, setLabel] = useState(initial.label);
  const [fieldType, setFieldType] = useState<MetadataFieldType>(initial.fieldType);
  const [options, setOptions] = useState<string[]>(initial.options);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>(initial.statusOptions);
  const [unit, setUnit] = useState(initial.unit);
  const [aiFillEnabled, setAiFillEnabled] = useState(initial.aiFillEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStatus = fieldType === "status";
  const isRelation = fieldType === "relation";
  const hasChoiceOptions = needsChoiceOptions(fieldType) && fieldType !== "checkbox" && !isStatus;

  const handleSave = async (): Promise<PropertyComposerSaveResult> => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return { ok: false, error: "Enter a property label" };
    }

    if (hasChoiceOptions && options.length === 0) {
      return { ok: false, error: "Add at least one option" };
    }

    if (isStatus && statusOptions.length === 0) {
      return { ok: false, error: "Add at least one status" };
    }

    setSaving(true);
    setError(null);
    const optionsPayload: string[] | StatusOption[] | { unit: string } | null = isStatus
      ? statusOptions
      : schemaOptionsWithUnit(
          hasChoiceOptions ? options : undefined,
          fieldType === "number" ? unit : undefined,
        );
    const payload = {
      field_label: trimmedLabel,
      field_type: fieldType,
      ai_fill_enabled: isRelation ? false : aiFillEnabled,
      ...(optionsPayload ? { options: optionsPayload } : {}),
    };
    const result =
      editingSchemaId && onUpdate
        ? await onUpdate(editingSchemaId, payload)
        : await onCreate(payload);
    setSaving(false);

    if (!result.ok) {
      const message = result.error ?? "Couldn't add property";
      if (!hideFooter) setError(message);
      return { ok: false, error: message };
    }
    return { ok: true };
  };

  useImperativeHandle(ref, () => ({ save: handleSave }));

  const body = (
    <div className="property-composer">
      <label className="property-composer__field">
        <span className="property-composer__field-label">Label</span>
        <Input
          variant="plain"
          value={label}
          onChange={setLabel}
          placeholder="e.g. Review date"
        />
      </label>

      {label.trim() && (
        <p className="caption property-composer__key">Key: {fieldKeyFromLabel(label)}</p>
      )}

      <div className="property-composer__field">
        <span className="property-composer__field-label">Type</span>
        <Dropdown
          variant="plain"
          value={fieldType}
          options={FIELD_TYPE_OPTIONS.map((type) => ({
            id: type,
            label: type === "checkbox" ? "Yes/No" : METADATA_FIELD_TYPE_LABELS[type],
          }))}
          onChange={(value) => setFieldType(value as MetadataFieldType)}
        />
      </div>

      {isStatus && (
        <div className="property-composer__field">
          <span className="property-composer__field-label">Statuses</span>
          <StatusOptionEditor options={statusOptions} onChange={setStatusOptions} />
        </div>
      )}

      {hasChoiceOptions && (
        <div className="property-composer__field">
          <span className="property-composer__field-label">Options</span>
          <OptionChipEditor options={options} onChange={setOptions} />
        </div>
      )}

      {fieldType === "number" && (
        <label className="property-composer__field">
          <span className="property-composer__field-label">Unit</span>
          <Input variant="plain" value={unit} onChange={setUnit} placeholder="e.g. %" />
        </label>
      )}

      {isRelation ? (
        <p className="caption property-composer__hint">
          Links to another document. AI suggestions aren&rsquo;t available for linked-document
          fields yet.
        </p>
      ) : (
        <Toggle
          className="property-composer__toggle"
          label="Enable AI suggestions"
          description="Rhodes can suggest a value from document content when this field is empty."
          checked={aiFillEnabled}
          onChange={(event) => setAiFillEnabled(event.target.checked)}
        />
      )}

      {!hideFooter && !isStatus && !isRelation && (
        <PropertyFieldPreview
          label={label}
          fieldType={fieldType}
          options={options}
          unit={unit}
        />
      )}

      {error && <p className="property-composer__error">{error}</p>}
    </div>
  );

  if (hideFooter) {
    return <div className="property-add-panel__composer">{body}</div>;
  }

  return (
    <>
      <div className="property-flyout__body overlay-scrollbar">{body}</div>
      <PanelActionBar
        end={
          <>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save property"}
            </Button>
          </>
        }
      />
    </>
  );
});
