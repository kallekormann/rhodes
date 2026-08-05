"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { Template } from "@/data/templates";
import { useDocuments } from "@/hooks/useDocuments";
import { deleteTemplate, useTemplates } from "@/hooks/useTemplates";
import { templateRecordToUi } from "@/lib/templates/map";
import { templatesEmptyCopy } from "@/lib/views/empty-states";
import { LoaderState } from "@/components/Loader";
import { OfflineGate } from "@/components/OfflineGate";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TemplateDetailPanel } from "@/components/TemplateDetailPanel";
import { IconLabelButton } from "@/components/IconLabelButton";
import { Dialog } from "@/components/Dialog";
import { ViewEmptyState } from "@/components/ViewEmptyState";
import {
  TEMPLATE_CATEGORY_CATALOG,
  type TemplateCategoryId,
} from "@rhodes/shared/system-templates";
import "./TemplatesView.css";

type TemplateTab = "mine" | TemplateCategoryId;

const TAB_OPTIONS: { value: TemplateTab; label: string }[] = [
  { value: "mine", label: "Mine" },
  ...TEMPLATE_CATEGORY_CATALOG.map((entry) => ({
    value: entry.id as TemplateTab,
    label: entry.label,
  })),
];

export function TemplatesView() {
  const {
    workspaceId,
    openEditor,
    openTemplateEditor,
    setDocumentTitle,
    setDocumentId,
    showToast,
    canWriteActiveScope,
    featureGates,
    session,
  } = useApp();
  const canCreateTemplates =
    canWriteActiveScope && featureGates.can("templates.create");
  const [tab, setTab] = useState<TemplateTab>("essentials");
  const [selected, setSelected] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const listFilter = tab === "mine" ? "mine" : "all";
  const { templates, loading, error, refresh } = useTemplates(
    workspaceId,
    listFilter,
  );
  const { createDocument } = useDocuments(workspaceId, "recent", session.userId);

  const filtered = useMemo(() => {
    const ui = templates.map(templateRecordToUi);
    if (tab === "mine") {
      return ui.filter((template) => template.mine);
    }
    return ui.filter(
      (template) => !template.mine && template.category === tab,
    );
  }, [templates, tab]);

  useEffect(() => {
    if (selected && !filtered.some((template) => template.id === selected.id)) {
      setSelected(null);
    }
  }, [filtered, selected]);

  const showLoader = clientReady && loading && filtered.length === 0;
  const showEmpty =
    clientReady && !loading && !error && filtered.length === 0;

  const handleCreateTemplate = async () => {
    if (!canCreateTemplates) {
      showToast("You don't have permission to create templates in this scope", "error");
      return;
    }
    if (!workspaceId || creating) return;
    setCreating(true);

    const created = await createDocument({
      title: "Untitled Template",
      metadata: { template_draft: true },
    });

    setCreating(false);

    if (!created) {
      showToast("Couldn't start template draft", "error");
      return;
    }

    setDocumentId(created.id);
    setDocumentTitle(created.title);
    openEditor(created.id);
  };

  const handleEdit = (template: Template) => {
    setSelected(null);
    openTemplateEditor(template.id);
  };

  const handleDeleteRequest = (template: Template) => {
    setDeleteTarget(template);
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      await refresh();
      showToast("Template deleted", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't delete template",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleUse = async (template: Template) => {
    if (!canWriteActiveScope) {
      showToast("You have read-only access in this scope", "error");
      return;
    }
    if (!workspaceId || creating) return;
    setCreating(true);

    const created = await createDocument({
      title: template.name,
      template_id: template.id,
    });

    setCreating(false);

    if (!created) {
      showToast("Couldn't create document from template", "error");
      return;
    }

    setDocumentId(created.id);
    setDocumentTitle(created.title);
    setSelected(null);
    openEditor(created.id);
  };

  return (
    <OfflineGate
      title="Templates offline"
      message="Open a cached document from Documents to keep working."
    >
    <div className={`templates-view ${selected ? "templates-view--panel-open" : ""}`}>
      <div className="templates-view__scroll overlay-scrollbar">
        <div className="templates-view__inner">
          <div className="templates-toolbar">
            <div className="templates-toolbar__tabs overlay-scrollbar">
              <SegmentedControl
                options={TAB_OPTIONS}
                value={tab}
                onChange={setTab}
              />
            </div>
            {canCreateTemplates ? (
              <IconLabelButton
                variant="ghost"
                icon={Plus}
                onClick={() => void handleCreateTemplate()}
              >
                Create template
              </IconLabelButton>
            ) : null}
          </div>

          {showLoader ? (
            <LoaderState
              label="Loading templates…"
              size="s"
              className="templates-view__status"
            />
          ) : error ? (
            <p className="caption templates-view__status">{error}</p>
          ) : showEmpty ? (
            <ViewEmptyState
              title={templatesEmptyCopy(tab === "mine").title}
              description={templatesEmptyCopy(tab === "mine").description}
              primaryAction={
                tab === "mine" && canCreateTemplates
                  ? {
                      label: "Create template",
                      onClick: () => {
                        void handleCreateTemplate();
                      },
                    }
                  : undefined
              }
            />
          ) : filtered.length > 0 ? (
            <ul className="template-list">
              {filtered.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className={`template-list__row ${selected?.id === template.id ? "template-list__row--active" : ""}`}
                    onClick={() => setSelected(template)}
                  >
                    <div className="template-list__main">
                      <span className="template-list__name">{template.name}</span>
                      <span className="template-list__desc">
                        {template.shortDescription}
                      </span>
                    </div>
                    {template.mine && (
                      <span className="template-list__badge">Mine</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <TemplateDetailPanel
        template={selected}
        onClose={() => setSelected(null)}
        onUse={handleUse}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />

      <Dialog
        open={deleteTarget != null}
        title="Delete template?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
    </OfflineGate>
  );
}
