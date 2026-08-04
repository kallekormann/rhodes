"use client";

import { addMonths, format, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DATE_VIEW_FIELD_TYPES } from "@rhodes/shared/view-engine";
import { useApp } from "@/context/AppContext";
import { useDocuments } from "@/hooks/useDocuments";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import { useViewInstances } from "@/hooks/useViewInstances";
import { usePublishScopeInstanceLabel } from "@/hooks/usePublishScopeInstanceLabel";
import { cacheDocumentTitle } from "@/lib/editor/editor-shell-session";
import { isDocumentArchived } from "@/lib/documents/metadata";
import { isDocumentNativeToScope } from "@/lib/documents/share-context";
import {
  bucketDocumentsByDay,
  buildAgendaSections,
  buildMonthGrid,
  calendarConfigFromInstance,
  isDayKeyInRange,
  resolveCalendarDateField,
} from "@/lib/views/calendar";
import { VIEW_HELP_CONTENT } from "@/lib/views/help-content";
import type { DocumentRecord } from "@/hooks/useDocument";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";
import { DocumentsSyncGate } from "@/components/DocumentsSyncGate";
import {
  DateRangeField,
  type DateRange,
} from "@/components/DateRangePicker";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { LoaderState } from "@/components/Loader";
import { SegmentedControl } from "@/components/SegmentedControl";
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
import "./CalendarView.css";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PER_CELL = 3;

type CalendarDisplayMode = "month" | "list";

function CalendarSettingsPanel({
  title,
  subtitle,
  dateFieldKey,
  dateFieldOptions,
  onClose,
  onSave,
  saving,
}: {
  title: string;
  subtitle: string;
  dateFieldKey: string;
  dateFieldOptions: MetadataSchemaField[];
  onClose: () => void;
  onSave: (input: { title: string; subtitle: string; dateFieldKey: string }) => void;
  saving: boolean;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const [draftDateFieldKey, setDraftDateFieldKey] = useState(dateFieldKey);
  const canSave = draftTitle.trim().length > 0 && draftDateFieldKey.length > 0;

  return (
    <ViewDockPanel
      title="Calendar settings"
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
              dateFieldKey: draftDateFieldKey,
            })
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <ViewSettingsField label="Title">
        <Input value={draftTitle} onChange={setDraftTitle} placeholder="Calendar title" />
      </ViewSettingsField>
      <ViewSettingsField label="Subtitle">
        <Input
          value={draftSubtitle}
          onChange={setDraftSubtitle}
          placeholder="Optional subtitle"
        />
      </ViewSettingsField>
      <ViewSettingsField label="Date field">
        {dateFieldOptions.length > 0 ? (
          <Dropdown
            variant="field"
            options={dateFieldOptions.map((field) => ({
              id: field.field_key,
              label: field.field_label,
            }))}
            value={draftDateFieldKey}
            onChange={setDraftDateFieldKey}
            placeholder="Choose a property…"
            aria-label="Date field"
          />
        ) : (
          <p className="caption view-settings-field__hint">
            Add a date or date-range property to power this calendar.
          </p>
        )}
      </ViewSettingsField>
    </ViewDockPanel>
  );
}

export function CalendarView() {
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
  } = useViewInstances(workspaceId, "calendar", {
    canWrite: canWriteActiveScope,
    onError: (message) => showToast(message, "error"),
  });

  usePublishScopeInstanceLabel(instance?.label);

  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>("month");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [panel, setPanel] = useState<ViewPanelMode>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const config = useMemo(() => calendarConfigFromInstance(instance), [instance]);
  const dateField = useMemo(
    () => resolveCalendarDateField(schemas, config),
    [schemas, config],
  );
  const dateFieldOptions = useMemo(
    () =>
      schemas.filter((schema) =>
        (DATE_VIEW_FIELD_TYPES as readonly string[]).includes(schema.field_type),
      ),
    [schemas],
  );

  useEffect(() => {
    setPanel(null);
  }, [workspaceId, activeInstanceId]);

  const pageTitle = instance?.label ?? "Calendar";

  const saveSettings = async (input: {
    title: string;
    subtitle: string;
    dateFieldKey: string;
  }) => {
    setSavingSettings(true);
    const nextConfig = {
      dateField: input.dateFieldKey,
      ...(config?.colorByField ? { colorByField: config.colorByField } : {}),
      ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    };
    const result = instance
      ? await updateInstance(instance.id, { label: input.title, config: nextConfig })
      : await createInstance({
          base_view_type: "calendar",
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

  const cells = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const buckets = useMemo(
    () =>
      dateField
        ? bucketDocumentsByDay(activeDocs, dateField)
        : new Map<string, DocumentRecord[]>(),
    [activeDocs, dateField],
  );

  const completeRange = useMemo(() => {
    if (dateRange.start && dateRange.end) {
      return { start: dateRange.start, end: dateRange.end };
    }
    return null;
  }, [dateRange.start, dateRange.end]);

  const agendaSections = useMemo(
    () =>
      buildAgendaSections({
        buckets,
        today: new Date(),
        range: completeRange,
      }),
    [buckets, completeRange],
  );

  const handleDateRangeChange = (next: DateRange) => {
    setDateRange(next);
    if (next.start && next.end) {
      setMonthAnchor(next.start);
    }
  };

  const openDoc = (doc: DocumentRecord) => {
    cacheDocumentTitle(doc.id, doc.title);
    setDocumentTitle(doc.title);
    setDocumentId(doc.id);
    openEditor(doc.id);
  };

  const calendarLoading = scopesPending || loading || schemasLoading || instancesLoading;
  const help = VIEW_HELP_CONTENT.calendar;
  const infoWarnings = !dateField
    ? [
        "This scope has no date property yet — add one, or pick one in Calendar settings.",
      ]
    : [];

  return (
    <DocumentsSyncGate>
      <div className="calendar-view">
        <div className="calendar-view__scroll">
          <div className="calendar-view__inner">
            <ViewInstanceTabBar
              className="calendar-view__tabs"
              tabs={instances.map((entry) => ({
                id: entry.id,
                label: entry.label,
              }))}
              activeId={activeInstanceId}
              onSelect={setActiveInstanceId}
              onCreate={(label) => createTab(label)}
              onDelete={(id) => deleteTab(id)}
              canEdit={canWriteActiveScope}
              createTitle="New calendar"
              deleteNoun="calendar"
              activeTabAccessory={
                <SegmentedControl
                  options={[
                    { value: "month", label: "Month" },
                    { value: "list", label: "List" },
                  ]}
                  value={displayMode}
                  onChange={setDisplayMode}
                />
              }
              trailing={
                <div className="calendar-view__toolbar">
                  <div className="calendar-view__nav" role="group" aria-label="Month">
                    <button
                      type="button"
                      className="calendar-view__nav-button"
                      aria-label="Previous month"
                      onClick={() => setMonthAnchor((prev) => subMonths(prev, 1))}
                    >
                      <ChevronLeft size={16} strokeWidth={1.75} />
                    </button>
                    <span className="calendar-view__month-label">
                      {format(monthAnchor, "MMM yyyy")}
                    </span>
                    <button
                      type="button"
                      className="calendar-view__nav-button"
                      aria-label="Next month"
                      onClick={() => setMonthAnchor((prev) => addMonths(prev, 1))}
                    >
                      <ChevronRight size={16} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="calendar-view__today-button"
                      onClick={() => setMonthAnchor(new Date())}
                    >
                      Today
                    </button>
                  </div>
                  <DateRangeField
                    className="field-root--inline calendar-view__range"
                    variant="plain"
                    value={dateRange}
                    onChange={handleDateRangeChange}
                    placeholder="Range"
                  />
                  <ViewHeaderActions
                    panel={panel}
                    onPanelChange={setPanel}
                    canEditSettings={canWriteActiveScope}
                  />
                </div>
              }
            />

            {instancesError ? (
              <p className="caption calendar-view__error">{instancesError}</p>
            ) : null}
            {error ? <p className="caption calendar-view__error">{error}</p> : null}

            {calendarLoading ? (
              <LoaderState label="Loading calendar…" />
            ) : !dateField ? (
              <p className="caption calendar-view__empty">
                This scope has no date or date-range properties yet. Add one in
                Settings, or create documents from a bundle that includes them.
              </p>
            ) : displayMode === "list" ? (
              <div className="calendar-agenda">
                {agendaSections.map((section) => (
                  <section
                    key={section.key}
                    className={`calendar-agenda__section${
                      section.isToday ? " calendar-agenda__section--today" : ""
                    }`}
                  >
                    <h3 className="calendar-agenda__day">{section.label}</h3>
                    {section.docs.length === 0 ? (
                      <p className="caption calendar-agenda__empty">No items</p>
                    ) : (
                      <ul className="calendar-agenda__list">
                        {section.docs.map((doc) => (
                          <li key={doc.id}>
                            <button
                              type="button"
                              className="calendar-agenda__item"
                              onClick={() => openDoc(doc)}
                              title={doc.title || "Untitled"}
                            >
                              {doc.title || "Untitled"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="calendar-grid">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="calendar-grid__weekday">
                    {label}
                  </div>
                ))}
                {cells.map((cell) => {
                  const docsForDay = buckets.get(cell.key) ?? [];
                  const visibleDocs = completeRange
                    ? isDayKeyInRange(cell.key, completeRange)
                      ? docsForDay
                      : []
                    : docsForDay;
                  const visible = visibleDocs.slice(0, MAX_VISIBLE_PER_CELL);
                  const overflow = visibleDocs.length - visible.length;

                  return (
                    <div
                      key={cell.key}
                      className={`calendar-cell${cell.inMonth ? "" : " calendar-cell--outside"}${
                        cell.isToday ? " calendar-cell--today" : ""
                      }`}
                    >
                      <span className="calendar-cell__date">{cell.date.getDate()}</span>
                      <div className="calendar-cell__docs">
                        {visible.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            className="calendar-doc-chip"
                            onClick={() => openDoc(doc)}
                            title={doc.title || "Untitled"}
                          >
                            {doc.title || "Untitled"}
                          </button>
                        ))}
                        {overflow > 0 ? (
                          <span className="calendar-cell__overflow">+{overflow} more</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {panel === "settings" ? (
          <CalendarSettingsPanel
            title={pageTitle}
            subtitle={config?.subtitle ?? ""}
            dateFieldKey={dateField?.field_key ?? ""}
            dateFieldOptions={dateFieldOptions}
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
