"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PanelActionBar } from "@/components/PanelActionBar";
import { Toggle } from "@/components/Toggle";
import { GroupInstancePreview } from "@/components/properties/GroupInstancePreview";
import { SubPropertyEditorRow } from "@/components/properties/SubPropertyEditorRow";
import { needsChoiceOptions } from "@/components/properties/OptionChipEditor";
import {
  fieldKeyFromLabel,
  parseSchemaOptions,
  parseSchemaUnit,
  schemaOptionsWithUnit,
  subKeyFromLabel,
  type MetadataFieldType,
  type MetadataSchemaGroup,
} from "@/lib/metadata/schemas";
import { PROPERTY_GROUP_PRESETS } from "@/lib/metadata/group-presets";
import "./property-composer.css";

export type PropertyComposerSaveResult =
  | { ok: true }
  | { ok: false; error: string };

export type PropertyGroupComposerHandle = {
  save: () => Promise<PropertyComposerSaveResult>;
};

type SubFieldDraft = {
  id: string;
  schemaId?: string;
  sub_key?: string;
  field_label: string;
  field_type: MetadataFieldType;
  options: string[];
  unit: string;
  ai_fill_enabled: boolean;
};

type PropertyGroupComposerProps = {
  initialPresetLabel?: string | null;
  initialGroup?: MetadataSchemaGroup | null;
  hideFooter?: boolean;
  onCancel: () => void;
  onCreate: (input: {
    group_label: string;
    fields: Array<{
      field_label: string;
      field_type: MetadataFieldType;
      sub_key?: string;
      options?: string[] | { unit: string };
      ai_fill_enabled?: boolean;
    }>;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdate?: (
    groupId: string,
    input: {
      group_label: string;
      fields: Array<{
        id?: string;
        field_label: string;
        field_type: MetadataFieldType;
        sub_key?: string;
        options?: string[] | { unit: string };
        ai_fill_enabled?: boolean;
      }>;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
};

function draftFromGroup(group: MetadataSchemaGroup) {
  return {
    groupLabel: group.group_label,
    fields: group.fields.map((field) => ({
      id: field.id,
      schemaId: field.id,
      sub_key: field.sub_key,
      field_label: field.field_label,
      field_type: field.field_type,
      options: parseSchemaOptions(field.options) ?? [],
      unit: parseSchemaUnit(field.options) ?? "",
      ai_fill_enabled: field.ai_fill_enabled ?? false,
    })),
  };
}

function draftFromPreset(presetLabel: string | null | undefined) {
  const preset = presetLabel
    ? PROPERTY_GROUP_PRESETS.find((item) => item.group_label === presetLabel)
    : null;

  if (!preset) {
    return {
      groupLabel: "",
      fields: [
        {
          id: crypto.randomUUID(),
          field_label: "",
          field_type: "text" as MetadataFieldType,
          options: [],
          unit: "",
          ai_fill_enabled: false,
        },
      ],
    };
  }

  return {
    groupLabel: preset.group_label,
    fields: preset.fields.map((field) => ({
      id: crypto.randomUUID(),
      field_label: field.field_label,
      field_type: field.field_type,
      options: field.options ?? [],
      unit: field.unit ?? "",
      ai_fill_enabled: field.ai_fill_enabled ?? false,
    })),
  };
}

export const PropertyGroupComposer = forwardRef<
  PropertyGroupComposerHandle,
  PropertyGroupComposerProps
>(function PropertyGroupComposer(
  { initialPresetLabel, initialGroup = null, hideFooter = false, onCancel, onCreate, onUpdate },
  ref,
) {
  const initial = initialGroup
    ? draftFromGroup(initialGroup)
    : draftFromPreset(initialPresetLabel);
  const editingGroupId = initialGroup?.id ?? null;
  const [groupLabel, setGroupLabel] = useState(initial.groupLabel);
  const [fields, setFields] = useState<SubFieldDraft[]>(initial.fields);
  const [groupAiFillEnabled, setGroupAiFillEnabled] = useState(
    initial.fields.some((field) => field.ai_fill_enabled),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (id: string, patch: Partial<SubFieldDraft>) => {
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );
  };

  const setGroupAiFill = (enabled: boolean) => {
    setGroupAiFillEnabled(enabled);
    setFields((current) => current.map((field) => ({ ...field, ai_fill_enabled: enabled })));
  };

  const addField = () => {
    setFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        field_label: "",
        field_type: "text",
        options: [],
        unit: "",
        ai_fill_enabled: groupAiFillEnabled,
      },
    ]);
  };

  const removeField = (id: string) => {
    setFields((current) =>
      current.length > 1 ? current.filter((field) => field.id !== id) : current,
    );
  };

  const handleSave = async (): Promise<PropertyComposerSaveResult> => {
    const trimmedLabel = groupLabel.trim();
    if (!trimmedLabel) {
      return { ok: false, error: "Enter a group name" };
    }

    try {
      const normalizedFields = fields
        .map((field) => {
          const field_label = field.field_label.trim();
          if (!field_label) return null;

          if (
            needsChoiceOptions(field.field_type) &&
            field.field_type !== "checkbox" &&
            field.options.length === 0
          ) {
            throw new Error(`"${field_label}" needs at least one option`);
          }

          const options = schemaOptionsWithUnit(
            needsChoiceOptions(field.field_type) && field.field_type !== "checkbox"
              ? field.options
              : undefined,
            field.field_type === "number" ? field.unit : undefined,
          );

          return {
            id: field.schemaId,
            field_label,
            field_type: field.field_type,
            sub_key: field.sub_key ?? subKeyFromLabel(field_label),
            ai_fill_enabled: field.ai_fill_enabled,
            ...(options ? { options } : {}),
          };
        })
        .filter(Boolean) as Array<{
        id?: string;
        field_label: string;
        field_type: MetadataFieldType;
        sub_key: string;
        options?: string[] | { unit: string };
        ai_fill_enabled: boolean;
      }>;

      if (normalizedFields.length === 0) {
        return { ok: false, error: "Add at least one sub-property" };
      }

      setSaving(true);
      setError(null);

      const result =
        editingGroupId && onUpdate
          ? await onUpdate(editingGroupId, {
              group_label: trimmedLabel,
              fields: normalizedFields,
            })
          : await onCreate({
              group_label: trimmedLabel,
              fields: normalizedFields,
            });
      setSaving(false);
      if (!result.ok) {
        const message = result.error ?? "Couldn't save group";
        if (!hideFooter) setError(message);
        return { ok: false, error: message };
      }
      return { ok: true };
    } catch (saveError) {
      setSaving(false);
      const message =
        saveError instanceof Error ? saveError.message : "Couldn't save group";
      if (!hideFooter) setError(message);
      return { ok: false, error: message };
    }
  };

  useImperativeHandle(ref, () => ({ save: handleSave }));

  const body = (
    <div className="property-composer">
      <label className="property-composer__field">
        <span className="property-composer__field-label">Group name</span>
        <Input variant="plain" value={groupLabel} onChange={setGroupLabel} placeholder="e.g. KPI" />
      </label>

      {groupLabel.trim() && (
        <p className="caption property-composer__key">Key: {fieldKeyFromLabel(groupLabel)}</p>
      )}

      <Toggle
        className="property-composer__toggle"
        label="Enable AI suggestions for this group"
        description="Applies to all sub-properties below. You can override each one individually."
        checked={groupAiFillEnabled}
        onChange={(event) => setGroupAiFill(event.target.checked)}
      />

      <div className="property-composer__field">
        <span className="property-composer__field-label">Sub-properties</span>
        {fields.map((field) => (
          <SubPropertyEditorRow
            key={field.id}
            label={field.field_label}
            fieldType={field.field_type}
            options={field.options}
            unit={field.unit}
            aiFillEnabled={field.ai_fill_enabled}
            onLabelChange={(value) => updateField(field.id, { field_label: value })}
            onFieldTypeChange={(value) => updateField(field.id, { field_type: value })}
            onOptionsChange={(value) => updateField(field.id, { options: value })}
            onUnitChange={(value) => updateField(field.id, { unit: value })}
            onAiFillEnabledChange={(value) => {
              setFields((current) => {
                const next = current.map((item) =>
                  item.id === field.id ? { ...item, ai_fill_enabled: value } : item,
                );
                setGroupAiFillEnabled(next.every((item) => item.ai_fill_enabled));
                return next;
              });
            }}
            onRemove={fields.length > 1 ? () => removeField(field.id) : undefined}
          />
        ))}
        <Button size="small" variant="secondary" icon={Plus} onClick={addField}>
          Add sub-property
        </Button>
      </div>

      {!hideFooter && (
        <GroupInstancePreview
          groupLabel={groupLabel}
          fields={fields.map((field) => ({
            id: field.id,
            field_label: field.field_label,
            field_type: field.field_type,
            options: schemaOptionsWithUnit(
              needsChoiceOptions(field.field_type) && field.field_type !== "checkbox"
                ? field.options
                : undefined,
              field.unit,
            ),
          }))}
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
              {saving ? "Saving…" : "Save group"}
            </Button>
          </>
        }
      />
    </>
  );
});
