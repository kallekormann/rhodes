"use client";

import "@svar-ui/react-gantt/all.css";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import { useEffect, useMemo, useState } from "react";
import {
  DATE_VIEW_FIELD_TYPES,
  KANBAN_GROUP_BY_FIELD_TYPES,
} from "@rhodes/shared/view-engine";
import { useApp } from "@/context/AppContext";
import { useDocuments } from "@/hooks/useDocuments";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import { useViewInstances } from "@/hooks/useViewInstances";
import { usePublishScopeInstanceLabel } from "@/hooks/usePublishScopeInstanceLabel";
import { cacheDocumentTitle } from "@/lib/editor/editor-shell-session";
import { isDocumentArchived } from "@/lib/documents/metadata";
import { isDocumentNativeToScope } from "@/lib/documents/share-context";
import {
  buildGanttTasks,
  ganttConfigFromInstance,
} from "@/lib/views/gantt";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";
import {
  ViewDockPanel,
  ViewSettingsField,
} from "@/components/views/ViewDockPanel";
import {
  ViewHeaderActions,
  type ViewPanelMode,
} from "@/components/views/ViewHeaderActions";
import { ViewInfoPanel } from "@/components/views/ViewInfoPanel";
import { ViewInstanceTabBar } from "@/components/views/ViewInstanceTabBar";
import "./GanttView.css";

const GANTT_TASK_TYPES = [
  { id: "task", label: "Task" },
  { id: "summary", label: "Summary" },
  { id: "milestone", label: "Milestone" },
  { id: "collision", label: "Overlapping" },
];

const NONE_OPTION = "__none__";

function GanttSettingsPanel({
  title,
  subtitle,
  startFieldKey,
  endFieldKey,
  groupFieldKey,
  dateFieldOptions,
  groupFieldOptions,
  onClose,
  onSave,
  saving,
}: {
  title: string;
  subtitle: string;
  startFieldKey: string;
  endFieldKey: string;
  groupFieldKey: string;
  dateFieldOptions: MetadataSchemaField[];
  groupFieldOptions: MetadataSchemaField[];
  onClose: () => void;
  onSave: (input: {
    title: string;
    subtitle: string;
    startFieldKey: string;
    endFieldKey: string;
    groupFieldKey: string;
  }) => void;
  saving: boolean;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const [draftStart, setDraftStart] = useState(startFieldKey);
  const [draftEnd, setDraftEnd] = useState(endFieldKey || NONE_OPTION);
  const [draftGroup, setDraftGroup] = useState(groupFieldKey || NONE_OPTION);
  const canSave = draftTitle.trim().length > 0 && draftStart.length > 0;

  return (
    <ViewDockPanel
      title="Roadmap settings"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="view-dock-panel__button"
          disabled={!canSave || saving}
          onClick={() =>
            onSave({
              title: draftTitle.trim(),
              subtitle: draftSubtitle.trim(),
              startFieldKey: draftStart,
              endFieldKey: draftEnd === NONE_OPTION ? "" : draftEnd,
              groupFieldKey: draftGroup === NONE_OPTION ? "" : draftGroup,
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <ViewSettingsField label="Title">
        <Input value={draftTitle} onChange={setDraftTitle} placeholder="Roadmap title" />
      </ViewSettingsField>
      <ViewSettingsField label="Subtitle">
        <Input
          value={draftSubtitle}
          onChange={setDraftSubtitle}
          placeholder="Optional subtitle"
        />
      </ViewSettingsField>
      <ViewSettingsField label="Start date field">
        {dateFieldOptions.length > 0 ? (
          <Dropdown
            variant="field"
            options={dateFieldOptions.map((field) => ({
              id: field.field_key,
              label: field.field_label,
            }))}
            value={draftStart}
            onChange={setDraftStart}
            placeholder="Choose a property…"
            aria-label="Start date field"
          />
        ) : (
          <p className="caption view-settings-field__hint">
            Add a date or date-range property to plot documents.
          </p>
        )}
      </ViewSettingsField>
      <ViewSettingsField label="End date field" hint="Optional. Leave unset for milestones or date-range start fields.">
        <Dropdown
          variant="field"
          options={[
            { id: NONE_OPTION, label: "None" },
            ...dateFieldOptions.map((field) => ({
              id: field.field_key,
              label: field.field_label,
            })),
          ]}
          value={draftEnd}
          onChange={setDraftEnd}
          aria-label="End date field"
        />
      </ViewSettingsField>
      <ViewSettingsField label="Group by" hint="Optional. Groups tasks under summary rows.">
        <Dropdown
          variant="field"
          options={[
            { id: NONE_OPTION, label: "None" },
            ...groupFieldOptions.map((field) => ({
              id: field.field_key,
              label: field.field_label,
            })),
          ]}
          value={draftGroup}
          onChange={setDraftGroup}
          aria-label="Group by"
        />
      </ViewSettingsField>
    </ViewDockPanel>
  );
}

export function GanttView() {
  const {
    workspaceId,
    scopesLoading,
    openEditor,
    setDocumentTitle,
    setDocumentId,
    canWriteActiveScope,
    showToast,
    session,
  } = useApp();

  const scopesPending = !workspaceId || scopesLoading;
  const { documents, loading, error } = useDocuments(
    workspaceId,
    "all",
    session.userId,
  );
  const { schemas, loading: schemasLoading } = useMetadataSchemas(workspaceId);
  const {
    instances,
    activeInstance: instance,
    activeId: activeInstanceId,
    setActiveId: setActiveInstanceId,
    loading: instancesLoading,
    error: instancesError,
    updateInstance,
    createInstance,
    createTab,
    deleteTab,
  } = useViewInstances(workspaceId, "gantt", {
    canWrite: canWriteActiveScope,
    onError: (message) => showToast(message, "error"),
  });

  usePublishScopeInstanceLabel(instance?.label);

  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const config = useMemo(() => ganttConfigFromInstance(instance), [instance]);

  useEffect(() => {
    setPanel(null);
  }, [workspaceId, activeInstanceId]);

  const dateFields = useMemo(
    () =>
      schemas.filter((schema) =>
        (DATE_VIEW_FIELD_TYPES as readonly string[]).includes(schema.field_type),
      ),
    [schemas],
  );
  const groupFieldOptions = useMemo(
    () =>
      schemas.filter((schema) =>
        (KANBAN_GROUP_BY_FIELD_TYPES as readonly string[]).includes(schema.field_type),
      ),
    [schemas],
  );

  const startField = useMemo<MetadataSchemaField | null>(() => {
    if (config?.startField) {
      const matched = dateFields.find((f) => f.field_key === config.startField);
      if (matched) return matched;
    }
    return dateFields[0] ?? null;
  }, [config, dateFields]);
  const endField = useMemo<MetadataSchemaField | null>(() => {
    if (!config?.endField) return null;
    return schemas.find((f) => f.field_key === config.endField) ?? null;
  }, [config, schemas]);
  const hierarchyFields = useMemo<MetadataSchemaField[]>(() => {
    if (!config?.hierarchyFields?.length) return [];
    return config.hierarchyFields
      .map((key) => schemas.find((f) => f.field_key === key))
      .filter((f): f is MetadataSchemaField => Boolean(f));
  }, [config, schemas]);

  const pageTitle = instance?.label ?? "Roadmap";

  const saveSettings = async (input: {
    title: string;
    subtitle: string;
    startFieldKey: string;
    endFieldKey: string;
    groupFieldKey: string;
  }) => {
    setSavingSettings(true);
    const nextConfig = {
      startField: input.startFieldKey,
      hierarchyFields: input.groupFieldKey ? [input.groupFieldKey] : [],
      ...(input.endFieldKey ? { endField: input.endFieldKey } : {}),
      ...(config?.colorByField ? { colorByField: config.colorByField } : {}),
      ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    };
    const result = instance
      ? await updateInstance(instance.id, { label: input.title, config: nextConfig })
      : await createInstance({
          base_view_type: "gantt",
          label: input.title,
          config: nextConfig,
        });
    setSavingSettings(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setPanel(null);
  };

  const activeDocs = useMemo(
    () =>
      documents.filter(
        (doc) => !isDocumentArchived(doc.metadata) && isDocumentNativeToScope(doc),
      ),
    [documents],
  );

  const tasks = useMemo(
    () =>
      startField
        ? buildGanttTasks(activeDocs, hierarchyFields, startField, endField)
        : [],
    [activeDocs, hierarchyFields, startField, endField],
  );

  const svarTasks = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        text: task.text,
        start: task.start,
        end: task.end,
        type: task.hasCollision ? "collision" : task.type,
        parent: task.parent,
        open: task.open,
      })),
    [tasks],
  );

  const docsById = useMemo(() => {
    const map = new Map<string, (typeof activeDocs)[number]>();
    for (const doc of activeDocs) map.set(doc.id, doc);
    return map;
  }, [activeDocs]);

  const ganttInit = (api: {
    on: (event: string, handler: (payload: { id: string | number }) => void) => void;
  }) => {
    api.on("show-editor", ({ id }) => {
      const doc = docsById.get(String(id));
      if (!doc) return;
      cacheDocumentTitle(doc.id, doc.title);
      setDocumentTitle(doc.title);
      setDocumentId(doc.id);
      openEditor(doc.id);
    });
  };

  const ganttLoading = scopesPending || loading || schemasLoading || instancesLoading;
  const help = VIEW_HELP_CONTENT.gantt;
  const infoWarnings = !startField
    ? [
        "This scope has no date property yet — add one, or set a start field in Roadmap settings.",
      ]
    : [];

  return (
    <DocumentsSyncGate>
      <div className="gantt-view">
        <ViewInstanceTabBar
          className="gantt-view__tabs"
          tabs={instances.map((entry) => ({
            id: entry.id,
            label: entry.label,
          }))}
          activeId={activeInstanceId}
          onSelect={setActiveInstanceId}
          onCreate={(label) => createTab(label)}
          onDelete={(id) => deleteTab(id)}
          canEdit={canWriteActiveScope}
          createTitle="New roadmap"
          deleteNoun="roadmap"
          trailing={
            <ViewHeaderActions
              panel={panel}
              onPanelChange={setPanel}
              canEditSettings={canWriteActiveScope}
            />
          }
        />

        {instancesError ? (
          <p className="caption gantt-view__error">{instancesError}</p>
        ) : null}
        {error ? <p className="caption gantt-view__error">{error}</p> : null}

        {ganttLoading ? (
          <LoaderState label="Loading roadmap…" />
        ) : !startField ? (
          <p className="caption gantt-view__empty">
            This scope has no date or date-range properties yet. Add one in Settings to
            plot documents on the roadmap.
          </p>
        ) : tasks.length === 0 ? (
          <p className="caption gantt-view__empty">
            No documents have a value for &ldquo;{startField.field_label}&rdquo; yet.
          </p>
        ) : (
          <div className="gantt-view__chart">
            <Willow>
              <Gantt tasks={svarTasks} taskTypes={GANTT_TASK_TYPES} init={ganttInit} />
            </Willow>
          </div>
        )}

        {panel === "settings" ? (
          <GanttSettingsPanel
            title={pageTitle}
            subtitle={config?.subtitle ?? ""}
            startFieldKey={startField?.field_key ?? ""}
            endFieldKey={endField?.field_key ?? ""}
            groupFieldKey={hierarchyFields[0]?.field_key ?? ""}
            dateFieldOptions={dateFields}
            groupFieldOptions={groupFieldOptions}
            onClose={() => setPanel(null)}
            onSave={(input) => {
              void saveSettings(input);
            }}
            saving={savingSettings}
          />
        ) : null}

        {panel === "info" ? (
          <ViewInfoPanel
            description={help.description}
            setupSteps={[...help.setupSteps]}
            actions={[...help.actions]}
            warnings={infoWarnings}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </div>
    </DocumentsSyncGate>
  );
}
