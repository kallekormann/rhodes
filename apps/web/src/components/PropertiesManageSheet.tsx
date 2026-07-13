"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import {
  fieldKeyFromLabel,
  METADATA_FIELD_TYPE_LABELS,
  type MetadataFieldType,
  type MetadataSchemaField,
} from "@/lib/metadata/schemas";
import { PROPERTY_PRESETS } from "@/lib/metadata/presets";
import "./PropertiesManageSheet.css";

type PropertiesManageSheetProps = {
  open: boolean;
  schemas: MetadataSchemaField[];
  onClose: () => void;
  onCreate: (input: {
    field_label: string;
    field_type: MetadataFieldType;
    options?: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (
    schemaId: string,
    purgeValues?: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
};

const fieldTypeOptions = (
  Object.entries(METADATA_FIELD_TYPE_LABELS) as [MetadataFieldType, string][]
).map(([id, label]) => ({ id, label }));

function needsOptions(fieldType: MetadataFieldType) {
  return fieldType === "select" || fieldType === "multi_select";
}

export function PropertiesManageSheet({
  open,
  schemas,
  onClose,
  onCreate,
  onDelete,
}: PropertiesManageSheetProps) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<MetadataFieldType>("text");
  const [optionsDraft, setOptionsDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MetadataSchemaField | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setAdding(false);
    setLabel("");
    setFieldType("text");
    setOptionsDraft("");
    setFormError(null);
  };

  const handleClose = () => {
    resetForm();
    setDeleteTarget(null);
    onClose();
  };

  const applyPreset = (presetLabel: string) => {
    const preset = PROPERTY_PRESETS.find((item) => item.label === presetLabel);
    if (!preset) return;
    setLabel(preset.label);
    setFieldType(preset.field_type);
    setOptionsDraft(preset.options?.join("\n") ?? "");
    setAdding(true);
    setFormError(null);
  };

  const handleCreate = async () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("Enter a property label");
      return;
    }

    const options = needsOptions(fieldType)
      ? optionsDraft
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : undefined;

    if (needsOptions(fieldType) && (!options || options.length === 0)) {
      setFormError("Add at least one option");
      return;
    }

    setSaving(true);
    setFormError(null);

    const result = await onCreate({
      field_label: trimmedLabel,
      field_type: fieldType,
      options,
    });

    setSaving(false);
    if (!result.ok) {
      setFormError(result.error ?? "Couldn't add property");
      return;
    }

    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await onDelete(deleteTarget.id, true);
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <>
      <Modal
        open={open}
        title="Manage properties"
        onClose={handleClose}
        footer={
          <Button variant="ghost" onClick={handleClose}>
            Done
          </Button>
        }
      >
        <div className="properties-manage">
          <p className="properties-manage__intro caption">
            Add or remove property definitions for all documents in this scope.
          </p>

          {!adding && (
            <>
              <div className="properties-manage__toolbar">
                <Button variant="secondary" onClick={() => setAdding(true)}>
                  Add property
                </Button>
              </div>

              <div className="properties-manage__presets">
                <p className="properties-manage__presets-label">Common properties</p>
                <div className="properties-manage__preset-list">
                  {PROPERTY_PRESETS.map((preset) => {
                    const exists = schemas.some(
                      (schema) =>
                        schema.field_key === fieldKeyFromLabel(preset.label),
                    );
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className="properties-manage__preset"
                        disabled={exists}
                        onClick={() => applyPreset(preset.label)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <ul className="properties-manage__list">
                {schemas.map((schema) => (
                  <li key={schema.id} className="properties-manage__item">
                    <div>
                      <strong>{schema.field_label}</strong>
                      <span className="properties-manage__meta">
                        {METADATA_FIELD_TYPE_LABELS[schema.field_type]}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setDeleteTarget(schema)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
                {schemas.length === 0 && (
                  <li className="properties-manage__empty caption">
                    No custom properties yet.
                  </li>
                )}
              </ul>
            </>
          )}

          {adding && (
            <div className="properties-manage__form">
              <div className="properties-manage__field">
                <span className="properties-manage__field-label">Label</span>
                <Input value={label} onChange={setLabel} placeholder="e.g. Review date" />
              </div>
              <div className="properties-manage__field">
                <span className="properties-manage__field-label">Type</span>
                <Dropdown
                  value={fieldType}
                  options={fieldTypeOptions}
                  onChange={(value) => setFieldType(value as MetadataFieldType)}
                />
              </div>
              {needsOptions(fieldType) && (
                <label className="properties-manage__options">
                  <span>Options (one per line)</span>
                  <textarea
                    className="textarea"
                    rows={5}
                    value={optionsDraft}
                    onChange={(event) => setOptionsDraft(event.target.value)}
                    placeholder={"draft\nin progress\ndone"}
                  />
                </label>
              )}
              {formError && <p className="properties-manage__error">{formError}</p>}
              <div className="properties-manage__form-actions">
                <Button variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={() => void handleCreate()} disabled={saving}>
                  {saving ? "Adding…" : "Add property"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Dialog
        open={deleteTarget !== null}
        title="Remove property?"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.field_label}" from this scope? Values on existing documents will also be cleared.`
            : ""
        }
        confirmLabel={deleting ? "Removing…" : "Remove"}
        destructive
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
