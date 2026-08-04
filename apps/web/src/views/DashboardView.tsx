"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type {
  DashboardAggregation,
  DashboardWidget,
  DashboardWidgetType,
} from "@rhodes/shared/view-engine";
import { useApp } from "@/context/AppContext";
import { useDashboardQuery } from "@/hooks/useDashboardQuery";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import { useViewInstances } from "@/hooks/useViewInstances";
import { usePublishScopeInstanceLabel } from "@/hooks/usePublishScopeInstanceLabel";
import { cacheDocumentTitle } from "@/lib/editor/editor-shell-session";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";
import {
  compatibleGroupFieldTypes,
  compatibleValueFieldTypes,
  createEmptyWidget,
  dashboardConfigFromInstance,
  isNumericAggregation,
} from "@/lib/views/dashboard";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import { RhodesBarChart, RhodesLineChart } from "@/components/charts/ChartFrame";
import { Dropdown } from "@/components/Dropdown";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import { NavLink } from "@/components/NavLink";
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
import "./DashboardView.css";

const WIDGET_TYPE_OPTIONS: { id: DashboardWidgetType; label: string }[] = [
  { id: "stat", label: "Stat" },
  { id: "breakdown", label: "Breakdown" },
  { id: "trend", label: "Trend" },
  { id: "list", label: "List" },
];

const AGGREGATION_OPTIONS: { id: DashboardAggregation; label: string }[] = [
  { id: "count", label: "Count" },
  { id: "sum", label: "Sum" },
  { id: "avg", label: "Average" },
  { id: "min", label: "Minimum" },
  { id: "max", label: "Maximum" },
];

function fieldOptions(
  schemas: MetadataSchemaField[],
  allowedTypes: readonly string[] | "any",
) {
  const filtered =
    allowedTypes === "any"
      ? schemas
      : schemas.filter((schema) => allowedTypes.includes(schema.field_type));
  return filtered.map((schema) => ({ id: schema.field_key, label: schema.field_label }));
}

function WidgetForm({
  initial,
  schemas,
  onSave,
  onCancel,
}: {
  initial: DashboardWidget;
  schemas: MetadataSchemaField[];
  onSave: (widget: DashboardWidget) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DashboardWidget>(initial);
  const showAggregation = draft.type !== "list";
  const showGroupBy = draft.type === "breakdown" || draft.type === "trend";

  const valueFieldOptions = fieldOptions(
    schemas,
    compatibleValueFieldTypes({ type: draft.type, aggregation: draft.aggregation }),
  );
  const groupFieldOptions = fieldOptions(schemas, compatibleGroupFieldTypes(draft.type));

  const canSave = draft.title.trim().length > 0 && draft.field.trim().length > 0;

  return (
    <div className="dashboard-widget-form" role="form" aria-label="Widget settings">
      <div className="dashboard-widget-form__row">
        <label className="dashboard-widget-form__label" htmlFor="widget-title">
          Title
        </label>
        <Input
          id="widget-title"
          value={draft.title}
          onChange={(value) => setDraft((prev) => ({ ...prev, title: value }))}
          placeholder="Widget title"
        />
      </div>

      <div className="dashboard-widget-form__row">
        <span className="dashboard-widget-form__label">Type</span>
        <Dropdown
          variant="field"
          options={WIDGET_TYPE_OPTIONS}
          value={draft.type}
          onChange={(id) =>
            setDraft((prev) => ({
              ...prev,
              type: id as DashboardWidgetType,
              groupByField: undefined,
            }))
          }
          aria-label="Widget type"
        />
      </div>

      {showAggregation ? (
        <div className="dashboard-widget-form__row">
          <span className="dashboard-widget-form__label">Aggregation</span>
          <Dropdown
            variant="field"
            options={AGGREGATION_OPTIONS}
            value={draft.aggregation ?? "count"}
            onChange={(id) =>
              setDraft((prev) => ({
                ...prev,
                aggregation: id as DashboardAggregation,
              }))
            }
            aria-label="Aggregation"
          />
        </div>
      ) : null}

      <div className="dashboard-widget-form__row">
        <span className="dashboard-widget-form__label">
          {draft.type === "list" ? "Field to show" : "Field"}
        </span>
        <Dropdown
          variant="field"
          options={valueFieldOptions}
          value={draft.field}
          placeholder="Choose a property…"
          searchable
          onChange={(id) => setDraft((prev) => ({ ...prev, field: id }))}
          aria-label="Field"
        />
        {draft.aggregation && isNumericAggregation(draft.aggregation) ? (
          <p className="caption dashboard-widget-form__hint">
            Only number properties can be summed or averaged.
          </p>
        ) : null}
      </div>

      {showGroupBy ? (
        <div className="dashboard-widget-form__row">
          <span className="dashboard-widget-form__label">Group by</span>
          <Dropdown
            variant="field"
            options={groupFieldOptions}
            value={draft.groupByField ?? ""}
            placeholder="Choose a property…"
            searchable
            onChange={(id) => setDraft((prev) => ({ ...prev, groupByField: id }))}
            aria-label="Group by field"
          />
        </div>
      ) : null}

      <div className="dashboard-widget-form__actions">
        <button
          type="button"
          className="dashboard-widget-form__button dashboard-widget-form__button--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="dashboard-widget-form__button dashboard-widget-form__button--primary"
          disabled={!canSave}
          onClick={() => onSave(draft)}
        >
          Save widget
        </button>
      </div>
    </div>
  );
}

function DashboardSettingsPanel({
  title,
  subtitle,
  onClose,
  onSave,
  saving,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSave: (input: { title: string; subtitle: string }) => void;
  saving: boolean;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const canSave = draftTitle.trim().length > 0;

  return (
    <ViewDockPanel
      title="Dashboard settings"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="view-dock-panel__button"
          disabled={!canSave || saving}
          onClick={() =>
            onSave({ title: draftTitle.trim(), subtitle: draftSubtitle.trim() })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <ViewSettingsField label="Title">
        <Input value={draftTitle} onChange={setDraftTitle} placeholder="Dashboard title" />
      </ViewSettingsField>
      <ViewSettingsField label="Subtitle">
        <Input
          value={draftSubtitle}
          onChange={setDraftSubtitle}
          placeholder="Optional subtitle"
        />
      </ViewSettingsField>
      <p className="caption view-settings-field__hint">
        Widget fields are configured per widget with Add widget / Edit.
      </p>
    </ViewDockPanel>
  );
}

export function DashboardView() {
  const {
    workspaceId,
    canWriteActiveScope,
    showToast,
    openEditor,
    setDocumentTitle,
    setDocumentId,
  } = useApp();

  const scopesPending = !workspaceId;
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
  } = useViewInstances(workspaceId, "dashboard", {
    canWrite: canWriteActiveScope,
    onError: (message) => showToast(message, "error"),
  });

  usePublishScopeInstanceLabel(instance?.label);

  const config = useMemo(() => dashboardConfigFromInstance(instance), [instance]);
  const widgets = config?.widgets ?? [];

  const { results, loading: resultsLoading, error: resultsError } =
    useDashboardQuery(workspaceId, widgets);
  const resultById = useMemo(() => {
    const map = new Map<string, (typeof results)[number]>();
    for (const result of results) map.set(result.id, result);
    return map;
  }, [results]);

  const [formState, setFormState] = useState<
    | { mode: "create" }
    | { mode: "edit"; widgetId: string }
    | null
  >(null);
  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setPanel(null);
    setFormState(null);
  }, [workspaceId, activeInstanceId]);

  const pageTitle = instance?.label ?? "Dashboard";
  const pageSubtitle = config?.subtitle ?? "";

  const openDoc = (documentId: string, title: string) => {
    cacheDocumentTitle(documentId, title);
    setDocumentTitle(title);
    setDocumentId(documentId);
    openEditor(documentId);
  };

  const persistWidgets = async (nextWidgets: DashboardWidget[]) => {
    setSaving(true);
    try {
      if (instance) {
        const result = await updateInstance(instance.id, {
          config: {
            widgets: nextWidgets,
            ...(pageSubtitle ? { subtitle: pageSubtitle } : {}),
          },
        });
        if (!result.ok) {
          showToast(result.error, "error");
        }
      } else {
        const result = await createInstance({
          base_view_type: "dashboard",
          label: "Dashboard",
          config: { widgets: nextWidgets },
        });
        if (!result.ok) {
          showToast(result.error, "error");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (input: { title: string; subtitle: string }) => {
    setSavingSettings(true);
    const nextConfig = {
      widgets,
      ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    };
    const result = instance
      ? await updateInstance(instance.id, { label: input.title, config: nextConfig })
      : await createInstance({
          base_view_type: "dashboard",
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

  const handleSaveWidget = async (widget: DashboardWidget) => {
    const existingIndex = widgets.findIndex((w) => w.id === widget.id);
    const nextWidgets =
      existingIndex >= 0
        ? widgets.map((w, index) => (index === existingIndex ? widget : w))
        : [...widgets, widget];
    setFormState(null);
    await persistWidgets(nextWidgets);
  };

  const handleRemoveWidget = async (widgetId: string) => {
    await persistWidgets(widgets.filter((w) => w.id !== widgetId));
  };

  const dashboardLoading = scopesPending || schemasLoading || instancesLoading;

  const editingWidget =
    formState?.mode === "edit"
      ? widgets.find((w) => w.id === formState.widgetId) ?? null
      : formState?.mode === "create"
        ? createEmptyWidget("stat")
        : null;

  const help = VIEW_HELP_CONTENT.dashboard;
  const infoWarnings =
    widgets.length === 0
      ? [
          "No widgets yet — add a Stat, Breakdown, Trend, or List and pick a metadata field to summarize.",
        ]
      : [];

  return (
    <DocumentsSyncGate>
      <div className="dashboard-view">
        <div className="dashboard-view__scroll overlay-scrollbar">
          <div className="dashboard-view__inner">
            <ViewInstanceTabBar
              className="dashboard-view__tabs"
              tabs={instances.map((entry) => ({
                id: entry.id,
                label: entry.label,
              }))}
              activeId={activeInstanceId}
              onSelect={setActiveInstanceId}
              onCreate={(label) => createTab(label)}
              onDelete={(id) => deleteTab(id)}
              canEdit={canWriteActiveScope}
              createTitle="New dashboard"
              deleteNoun="dashboard"
              trailing={
                <ViewHeaderActions
                  panel={panel}
                  onPanelChange={setPanel}
                  canEditSettings={canWriteActiveScope}
                  extra={
                    canWriteActiveScope && !formState ? (
                      <NavLink
                        size="small"
                        onClick={() => setFormState({ mode: "create" })}
                      >
                        Add widget
                      </NavLink>
                    ) : null
                  }
                />
              }
            />

            {instancesError ? (
              <p className="caption dashboard-view__error">{instancesError}</p>
            ) : null}
            {resultsError ? (
              <p className="caption dashboard-view__error">{resultsError}</p>
            ) : null}
            {saving ? <p className="caption dashboard-view__hint">Saving…</p> : null}

            {dashboardLoading ? (
              <LoaderState label="Loading dashboard…" align="fill" />
            ) : (
              <>
                {editingWidget ? (
                  <WidgetForm
                    initial={editingWidget}
                    schemas={schemas}
                    onSave={handleSaveWidget}
                    onCancel={() => setFormState(null)}
                  />
                ) : null}

                {widgets.length === 0 && !editingWidget ? (
                  <p className="caption dashboard-view__empty">
                    {canWriteActiveScope
                      ? "No widgets yet. Add a stat, breakdown, trend, or list to summarize this scope's documents."
                      : "This dashboard has no widgets yet."}
                  </p>
                ) : (
                  <div className="dashboard-grid">
                    {widgets.map((widget) => {
                      const result = resultById.get(widget.id);
                      return (
                        <div key={widget.id} className="dashboard-widget-card">
                          <header className="dashboard-widget-card__header">
                            <h3 className="dashboard-widget-card__title">
                              {widget.title}
                            </h3>
                            {canWriteActiveScope ? (
                              <div className="dashboard-widget-card__actions">
                                <button
                                  type="button"
                                  aria-label={`Edit ${widget.title}`}
                                  className="dashboard-widget-card__icon-button"
                                  onClick={() =>
                                    setFormState({ mode: "edit", widgetId: widget.id })
                                  }
                                >
                                  <Pencil size={14} strokeWidth={1.75} />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Remove ${widget.title}`}
                                  className="dashboard-widget-card__icon-button"
                                  onClick={() => handleRemoveWidget(widget.id)}
                                >
                                  <Trash2 size={14} strokeWidth={1.75} />
                                </button>
                              </div>
                            ) : null}
                          </header>

                          <div className="dashboard-widget-card__body">
                            {resultsLoading && !result ? (
                              <LoaderState size="s" />
                            ) : !result || result.type === "error" ? (
                              <p className="caption dashboard-view__error">
                                {result?.type === "error" ? result.error : "No data"}
                              </p>
                            ) : result.type === "stat" ? (
                              <p className="dashboard-stat__value">
                                {Number.isInteger(result.value)
                                  ? result.value
                                  : result.value.toFixed(1)}
                              </p>
                            ) : result.type === "breakdown" ? (
                              <RhodesBarChart
                                data={result.groups}
                                xKey="label"
                                yKeys={["value"]}
                                height={200}
                              />
                            ) : result.type === "trend" ? (
                              <RhodesLineChart
                                data={result.points}
                                xKey="label"
                                yKeys={["value"]}
                                height={200}
                              />
                            ) : (
                              <ul className="dashboard-list">
                                {result.items.length === 0 ? (
                                  <li className="caption dashboard-view__empty">
                                    No documents
                                  </li>
                                ) : (
                                  result.items.map((item) => (
                                    <li key={item.id}>
                                      <button
                                        type="button"
                                        className="dashboard-list__item"
                                        onClick={() => openDoc(item.id, item.title)}
                                      >
                                        <span className="dashboard-list__title">
                                          {item.title}
                                        </span>
                                        <span className="dashboard-list__value">
                                          {item.value}
                                        </span>
                                      </button>
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {panel === "settings" ? (
          <DashboardSettingsPanel
            title={pageTitle}
            subtitle={pageSubtitle}
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
