"use client";

import { useRef } from "react";
import { TabBar } from "@/components/TabBar";
import {
  PropertyFieldComposer,
  type PropertyFieldComposerHandle,
} from "@/components/properties/PropertyFieldComposer";
import {
  PropertyGroupComposer,
  type PropertyGroupComposerHandle,
} from "@/components/properties/PropertyGroupComposer";
import { PropertyPresetRow } from "@/components/properties/PropertyPresetRow";
import { type MetadataFieldType, type MetadataSchemaField, type MetadataSchemaGroup } from "@/lib/metadata/schemas";
import { PROPERTY_GROUP_PRESETS } from "@/lib/metadata/group-presets";
import { PROPERTY_PRESETS } from "@/lib/metadata/presets";
import {
  fieldPresetToPreviewFields,
  groupPresetToPreviewFields,
} from "@/components/properties/property-preview-utils";
import "./PropertyAddPanel.css";

export type PropertyAddTab = "presets" | "customSingle" | "customGroup";

const ADD_TAB_OPTIONS: Array<{ value: PropertyAddTab; label: string }> = [
  { value: "customSingle", label: "Single" },
  { value: "customGroup", label: "Group" },
  { value: "presets", label: "Preset" },
];

type PropertyAddPanelProps = {
  tab: PropertyAddTab;
  onTabChange: (tab: PropertyAddTab) => void;
  editFieldPresetLabel?: string | null;
  editGroupPresetLabel?: string | null;
  editingField?: MetadataSchemaField | null;
  editingGroup?: MetadataSchemaGroup | null;
  onAddFieldPreset: (label: string) => void;
  onAddGroupPreset: (label: string) => void;
  onEditFieldPreset: (label: string) => void;
  onEditGroupPreset: (label: string) => void;
  onCreateSchema: (input: {
    field_label: string;
    field_type: MetadataFieldType;
    options?: string[] | { unit: string };
    ai_fill_enabled?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCreateGroup: (input: {
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
  onUpdateSchema?: (
    schemaId: string,
    input: {
      field_label: string;
      field_type: MetadataFieldType;
      options?: string[] | { unit: string };
      ai_fill_enabled?: boolean;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
  onUpdateGroup?: (
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
  fieldComposerRef?: React.RefObject<PropertyFieldComposerHandle | null>;
  groupComposerRef?: React.RefObject<PropertyGroupComposerHandle | null>;
};

export function PropertyAddPanel({
  tab,
  onTabChange,
  editFieldPresetLabel = null,
  editGroupPresetLabel = null,
  editingField = null,
  editingGroup = null,
  onAddFieldPreset,
  onAddGroupPreset,
  onEditFieldPreset,
  onEditGroupPreset,
  onCreateSchema,
  onCreateGroup,
  onUpdateSchema,
  onUpdateGroup,
  fieldComposerRef,
  groupComposerRef,
}: PropertyAddPanelProps) {
  const internalFieldRef = useRef<PropertyFieldComposerHandle>(null);
  const internalGroupRef = useRef<PropertyGroupComposerHandle>(null);
  const fieldRef = fieldComposerRef ?? internalFieldRef;
  const groupRef = groupComposerRef ?? internalGroupRef;

  return (
    <div className="property-add-panel">
      <div className="property-add-panel__tabs">
        <TabBar
          className="tab-bar--segment"
          options={ADD_TAB_OPTIONS}
          value={tab}
          onChange={onTabChange}
        />
      </div>

      <div className="property-add-panel__body overlay-scrollbar">
        {tab === "presets" && (
          <>
            <section className="property-pick__section">
              <h5 className="props-list__section-title">Core metadata</h5>
              {PROPERTY_PRESETS.map((preset) => (
                <PropertyPresetRow
                  key={preset.label}
                  fields={fieldPresetToPreviewFields(preset)}
                  onAdd={() => onAddFieldPreset(preset.label)}
                  onEdit={() => onEditFieldPreset(preset.label)}
                />
              ))}
            </section>

            <section className="property-pick__section">
              <h5 className="props-list__section-title">Metric groups</h5>
              {PROPERTY_GROUP_PRESETS.map((preset) => (
                <PropertyPresetRow
                  key={preset.group_label}
                  groupLabel={preset.group_label}
                  fields={groupPresetToPreviewFields(preset)}
                  onAdd={() => onAddGroupPreset(preset.group_label)}
                  onEdit={() => onEditGroupPreset(preset.group_label)}
                />
              ))}
            </section>
          </>
        )}

        {tab === "customSingle" && (
          <PropertyFieldComposer
            ref={fieldRef}
            key={editingField?.id ?? editFieldPresetLabel ?? "custom-field"}
            initialPresetLabel={editFieldPresetLabel}
            initialField={editingField}
            hideFooter
            onCancel={() => {}}
            onCreate={onCreateSchema}
            onUpdate={onUpdateSchema}
          />
        )}

        {tab === "customGroup" && (
          <PropertyGroupComposer
            ref={groupRef}
            key={editingGroup?.id ?? editGroupPresetLabel ?? "custom-group"}
            initialPresetLabel={editGroupPresetLabel}
            initialGroup={editingGroup}
            hideFooter
            onCancel={() => {}}
            onCreate={onCreateGroup}
            onUpdate={onUpdateGroup}
          />
        )}
      </div>
    </div>
  );
}

export type { PropertyFieldComposerHandle, PropertyGroupComposerHandle };
