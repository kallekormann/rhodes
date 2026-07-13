"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { Input } from "@/components/Input";
import { PanelActionBar } from "@/components/PanelActionBar";
import { useApp } from "@/context/AppContext";
import {
  PropertyAddPanel,
  type PropertyAddTab,
  type PropertyFieldComposerHandle,
  type PropertyGroupComposerHandle,
} from "@/components/properties/PropertyAddPanel";
import { GroupInstanceSection } from "@/components/properties/GroupInstanceSection";
import { PropertyManageGroup } from "@/components/properties/PropertyManageGroup";
import { PropertyManageRow } from "@/components/properties/PropertyManageRow";
import { SchemaFieldRow } from "@/components/properties/SchemaFieldRow";
import { useBufferedStringValue } from "@/components/properties/useBufferedFieldValue";
import { TextArea } from "@/components/TextArea";
import type {
  MetadataFieldType,
  MetadataFieldValue,
  MetadataSchemaField,
  MetadataSchemaGroup,
} from "@/lib/metadata/schemas";
import {
  readMetadataFieldValue,
  subKeyFromLabel,
  withGroupInstanceField,
} from "@/lib/metadata/schemas";
import { PROPERTY_GROUP_PRESETS } from "@/lib/metadata/group-presets";
import { PROPERTY_PRESETS } from "@/lib/metadata/presets";
import type { TemplateMetadata } from "@/lib/templates/metadata";
import "./PropertiesTab.css";
import "@/components/panel-shell.css";
import "@/components/properties/property-composer.css";
import "@/components/properties/PropertyAddPanel.css";

export type PropertiesPanelStage = "view" | "manage" | "add";

type PropertiesTabProps = {
  mode: "document" | "template";
  stage?: PropertiesPanelStage;
  onStageChange?: (stage: PropertiesPanelStage) => void;
  metadata: Record<string, unknown> | null;
  metadataSchemas: MetadataSchemaField[];
  metadataGroups: MetadataSchemaGroup[];
  metadataSchemasLoading?: boolean;
  createMetadataSchema: (input: {
    field_label: string;
    field_type: MetadataFieldType;
    options?: string[] | { unit: string };
    ai_fill_enabled?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  createMetadataGroup: (input: {
    group_label: string;
    repeatable?: boolean;
    fields: Array<{
      field_label: string;
      field_type: MetadataFieldType;
      sub_key?: string;
      options?: string[] | { unit: string };
      ai_fill_enabled?: boolean;
    }>;
  }) => Promise<{ ok: boolean; error?: string }>;
  updateMetadataSchema: (
    schemaId: string,
    input: {
      field_label: string;
      field_type: MetadataFieldType;
      options?: string[] | { unit: string };
      ai_fill_enabled?: boolean;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
  updateMetadataGroup: (
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
  deleteMetadataSchema: (
    schemaId: string,
    purgeValues?: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteMetadataGroup: (
    groupId: string,
    purgeValues?: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  createdAtLabel?: string | null;
  createdByLabel?: string | null;
  templateDescription?: string | null;
  templateMetadata?: TemplateMetadata;
  onMetadataFieldChange?: (fieldKey: string, value: MetadataFieldValue) => void;
  onMetadataGroupInstancesChange?: (metadata: Record<string, unknown>) => void;
  onTemplateDescriptionChange?: (description: string) => void;
  onTemplateMetadataChange?: (metadata: TemplateMetadata) => void;
};

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
    <div className="props-list__row">
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

function SystemReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="props-list__row">
      <dt>{label}</dt>
      <dd className="props-list__readonly">{value}</dd>
    </div>
  );
}

function BufferedTemplateDescription({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { draft, setDraft, onFocus, onBlur } = useBufferedStringValue(value, onChange);

  return (
    <TextArea
      className="props-textarea"
      variant="plain"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      rows={4}
      placeholder="Describe when to use this template"
    />
  );
}

export function PropertiesTab({
  mode,
  stage: stageProp,
  onStageChange,
  metadata,
  metadataSchemas: schemas,
  metadataGroups: groups,
  metadataSchemasLoading: loading = false,
  createMetadataSchema: createSchema,
  createMetadataGroup: createGroup,
  updateMetadataSchema: updateSchema,
  updateMetadataGroup: updateGroup,
  deleteMetadataSchema: deleteSchema,
  deleteMetadataGroup: deleteGroup,
  createdAtLabel,
  createdByLabel,
  templateDescription = "",
  templateMetadata,
  onMetadataFieldChange,
  onMetadataGroupInstancesChange,
  onTemplateDescriptionChange,
  onTemplateMetadataChange,
}: PropertiesTabProps) {
  const { showToast } = useApp();

  const [internalStage, setInternalStage] = useState<PropertiesPanelStage>("view");
  const stage = stageProp ?? internalStage;
  const setStage = onStageChange ?? setInternalStage;

  const [addTab, setAddTab] = useState<PropertyAddTab>("customSingle");
  const [editFieldPresetLabel, setEditFieldPresetLabel] = useState<string | null>(null);
  const [editGroupPresetLabel, setEditGroupPresetLabel] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<MetadataSchemaField | null>(null);
  const [editingGroup, setEditingGroup] = useState<MetadataSchemaGroup | null>(null);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<MetadataSchemaField | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<MetadataSchemaGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);

  const fieldComposerRef = useRef<PropertyFieldComposerHandle>(null);
  const groupComposerRef = useRef<PropertyGroupComposerHandle>(null);

  const aiFilledKeys = new Set(
    metadata && Array.isArray(metadata._ai_filled_keys)
      ? metadata._ai_filled_keys.filter((key): key is string => typeof key === "string")
      : [],
  );
  const wordCount =
    metadata && typeof metadata.word_count === "number" ? metadata.word_count : null;

  const handleMetadataFieldChange = useCallback(
    (fieldKey: string, value: MetadataFieldValue) => {
      onMetadataFieldChange?.(fieldKey, value);
    },
    [onMetadataFieldChange],
  );

  const handleGroupFieldChange = useCallback(
    (
      groupKey: string,
      instanceIndex: number,
      subKey: string,
      value: MetadataFieldValue,
    ) => {
      if (!metadata) return;
      onMetadataGroupInstancesChange?.(
        withGroupInstanceField(metadata, groupKey, instanceIndex, subKey, value),
      );
    },
    [metadata, onMetadataGroupInstancesChange],
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

  const handleDeleteField = async () => {
    if (!deleteFieldTarget) return;
    setDeleting(true);
    const result = await deleteSchema(deleteFieldTarget.id, true);
    setDeleting(false);
    setDeleteFieldTarget(null);
    if (result.ok) {
      showToast("Property removed", "success");
    } else {
      showToast(result.error ?? "Couldn't remove property", "error");
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setDeleting(true);
    const result = await deleteGroup(deleteGroupTarget.id, true);
    setDeleting(false);
    setDeleteGroupTarget(null);
    if (result.ok) {
      showToast("Property group removed", "success");
    } else {
      showToast(result.error ?? "Couldn't remove property group", "error");
    }
  };

  const openManage = () => setStage("manage");

  const openAdd = (tab: PropertyAddTab = "customSingle") => {
    setAddTab(tab);
    setEditFieldPresetLabel(null);
    setEditGroupPresetLabel(null);
    setEditingField(null);
    setEditingGroup(null);
    setStage("add");
  };

  const openEditField = (field: MetadataSchemaField) => {
    setEditingField(field);
    setEditingGroup(null);
    setEditFieldPresetLabel(null);
    setEditGroupPresetLabel(null);
    setAddTab("customSingle");
    setStage("add");
  };

  const openEditGroup = (group: MetadataSchemaGroup) => {
    setEditingGroup(group);
    setEditingField(null);
    setEditFieldPresetLabel(null);
    setEditGroupPresetLabel(null);
    setAddTab("customGroup");
    setStage("add");
  };

  const handlePresetAdd = async (presetLabelValue: string) => {
    const preset = PROPERTY_PRESETS.find((item) => item.label === presetLabelValue);
    if (!preset) return;
    const result = await createSchema({
      field_label: preset.label,
      field_type: preset.field_type,
      options: preset.options,
      ai_fill_enabled: preset.ai_fill_enabled,
    });
    if (result.ok) {
      showToast("Property added", "success");
      setStage("manage");
      setAddTab("customSingle");
    } else {
      showToast(result.error ?? "Couldn't add property", "error");
    }
  };

  const handleGroupPresetAdd = async (presetLabelValue: string) => {
    const preset = PROPERTY_GROUP_PRESETS.find((item) => item.group_label === presetLabelValue);
    if (!preset) return;
    const result = await createGroup({
      group_label: preset.group_label,
      fields: preset.fields.map((field) => {
        const options =
          field.options ?? (field.unit ? { unit: field.unit } : undefined);
        return {
          field_label: field.field_label,
          field_type: field.field_type,
          sub_key: subKeyFromLabel(field.field_label),
          ai_fill_enabled: field.ai_fill_enabled,
          ...(options ? { options } : {}),
        };
      }),
    });
    if (result.ok) {
      showToast("Property group added", "success");
      setStage("manage");
      setAddTab("customSingle");
    } else {
      showToast(result.error ?? "Couldn't add property group", "error");
    }
  };

  const handleSaveAndAdd = async () => {
    if (addTab === "presets") return;
    setSavingAdd(true);
    const result =
      addTab === "customSingle"
        ? await fieldComposerRef.current?.save()
        : await groupComposerRef.current?.save();
    setSavingAdd(false);
    if (!result) {
      showToast("Couldn't save property", "error");
      return;
    }
    if (result.ok) {
      const isEditing = Boolean(editingField || editingGroup);
      showToast(
        isEditing
          ? addTab === "customSingle"
            ? "Property updated"
            : "Property group updated"
          : addTab === "customSingle"
            ? "Property added"
            : "Property group added",
        "success",
      );
      setStage("manage");
      setEditFieldPresetLabel(null);
      setEditGroupPresetLabel(null);
      setEditingField(null);
      setEditingGroup(null);
      setAddTab("customSingle");
    } else {
      showToast(result.error, "error");
    }
  };

  if (loading) {
    return (
      <div className="panel-shell panel-shell--properties">
        <div className="panel-shell__scroll">
          <p className="caption">Loading properties…</p>
        </div>
      </div>
    );
  }

  const renderDocumentBody = () => {
    if (stage === "add") {
      return (
        <PropertyAddPanel
          tab={addTab}
          onTabChange={setAddTab}
          editFieldPresetLabel={editFieldPresetLabel}
          editGroupPresetLabel={editGroupPresetLabel}
          editingField={editingField}
          editingGroup={editingGroup}
          onAddFieldPreset={(label) => void handlePresetAdd(label)}
          onAddGroupPreset={(label) => void handleGroupPresetAdd(label)}
          onEditFieldPreset={(label) => {
            setEditingField(null);
            setEditingGroup(null);
            setEditFieldPresetLabel(label);
            setEditGroupPresetLabel(null);
            setAddTab("customSingle");
          }}
          onEditGroupPreset={(label) => {
            setEditingField(null);
            setEditingGroup(null);
            setEditGroupPresetLabel(label);
            setEditFieldPresetLabel(null);
            setAddTab("customGroup");
          }}
          onCreateSchema={createSchema}
          onCreateGroup={createGroup}
          onUpdateSchema={updateSchema}
          onUpdateGroup={updateGroup}
          fieldComposerRef={fieldComposerRef}
          groupComposerRef={groupComposerRef}
        />
      );
    }

    const isManage = stage === "manage";

    return (
      <div className={`props-list ${isManage ? "props-list--manage" : ""}`}>
        {createdAtLabel && <SystemReadonlyRow label="Created" value={createdAtLabel} />}
        {createdByLabel && <SystemReadonlyRow label="Created by" value={createdByLabel} />}
        {wordCount !== null && (
          <SystemReadonlyRow label="Word count" value={String(wordCount)} />
        )}

        {isManage ? (
          <div className="props-list__fields">
            {schemas.map((field) => (
              <PropertyManageRow
                key={field.id}
                field={field}
                value={readMetadataFieldValue(metadata, field)}
                aiSuggested={field.ai_fill_enabled === true && aiFilledKeys.has(field.field_key)}
                onEdit={() => openEditField(field)}
                onRemove={() => setDeleteFieldTarget(field)}
              />
            ))}
          </div>
        ) : (
          <dl className="props-list__fields">
            {schemas.map((field) => (
              <SchemaFieldRow
                key={field.id}
                field={field}
                value={readMetadataFieldValue(metadata, field)}
                onChange={(value) => handleMetadataFieldChange(field.field_key, value)}
                aiSuggested={field.ai_fill_enabled === true && aiFilledKeys.has(field.field_key)}
              />
            ))}
          </dl>
        )}

        {groups.map((group) =>
          isManage ? (
            <PropertyManageGroup
              key={group.id}
              group={group}
              metadata={metadata}
              onEdit={() => openEditGroup(group)}
              onRemove={() => setDeleteGroupTarget(group)}
            />
          ) : (
            <GroupInstanceSection
              key={group.id}
              group={group}
              metadata={metadata}
              onInstanceFieldChange={handleGroupFieldChange}
            />
          ),
        )}

        {schemas.length === 0 && groups.length === 0 && (
          <p className="caption property-panel__empty">
            No properties on this document yet. Use Manage to add fields or groups.
          </p>
        )}
      </div>
    );
  };

  const renderActionBar = () => {
    if (mode !== "document") return null;

    if (stage === "view") {
      return <PanelActionBar end={<Button onClick={openManage}>Manage</Button>} />;
    }

    if (stage === "manage") {
      return (
        <PanelActionBar
          start={
            <Button variant="secondary" onClick={() => setStage("view")}>
              Back
            </Button>
          }
          end={<Button onClick={() => openAdd("customSingle")}>Add property</Button>}
        />
      );
    }

    return (
      <PanelActionBar
        start={
          <Button variant="secondary" onClick={() => setStage("manage")}>
            Cancel
          </Button>
        }
        end={
          addTab !== "presets" ? (
            <Button onClick={() => void handleSaveAndAdd()} disabled={savingAdd}>
              {savingAdd
                ? "Saving…"
                : editingField || editingGroup
                  ? "Save changes"
                  : "Save & add"}
            </Button>
          ) : undefined
        }
      />
    );
  };

  const hasDocumentActionBar = mode === "document";
  const scrollClassName = [
    "panel-shell__scroll",
    "overlay-scrollbar",
    hasDocumentActionBar ? "panel-shell__scroll--with-actionbar" : "",
    stage === "add" ? "panel-shell__scroll--add" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`panel-shell panel-shell--properties panel-tab panel-tab--properties panel-shell--properties--${stage}`}
    >
      <div className={scrollClassName}>
        {mode === "template" ? (
          <dl className="props-list">
            <div className="props-list__row props-list__row--stacked">
              <dt>Description</dt>
              <dd>
                <BufferedTemplateDescription
                  value={templateDescription ?? ""}
                  onChange={(next) => onTemplateDescriptionChange?.(next)}
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
          </dl>
        ) : (
          renderDocumentBody()
        )}
      </div>

      {renderActionBar()}

      <Dialog
        open={deleteFieldTarget !== null}
        title="Remove property?"
        description={
          deleteFieldTarget
            ? `Remove "${deleteFieldTarget.field_label}" from this document? Existing values will be cleared.`
            : ""
        }
        confirmLabel={deleting ? "Removing…" : "Remove"}
        destructive
        onConfirm={() => void handleDeleteField()}
        onClose={() => setDeleteFieldTarget(null)}
      />

      <Dialog
        open={deleteGroupTarget !== null}
        title="Remove property group?"
        description={
          deleteGroupTarget
            ? `Remove "${deleteGroupTarget.group_label}" and all its sub-properties from this document?`
            : ""
        }
        confirmLabel={deleting ? "Removing…" : "Remove"}
        destructive
        onConfirm={() => void handleDeleteGroup()}
        onClose={() => setDeleteGroupTarget(null)}
      />
    </div>
  );
}
