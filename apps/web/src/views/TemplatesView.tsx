"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { Template } from "@/data/templates";
import { useDocuments } from "@/hooks/useDocuments";
import { deleteTemplate, useTemplates } from "@/hooks/useTemplates";
import { templateRecordToUi } from "@/lib/templates/map";
import { LoaderState } from "@/components/Loader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TemplateDetailPanel } from "@/components/TemplateDetailPanel";
import { IconLabelButton } from "@/components/IconLabelButton";
import { Dialog } from "@/components/Dialog";
import "./TemplatesView.css";

type TemplateTab = "all" | "mine";

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
  } = useApp();
  const canCreateTemplates =
    canWriteActiveScope && featureGates.can("templates.create");
  const [tab, setTab] = useState<TemplateTab>("all");
  const [selected, setSelected] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { templates, loading, error, refresh } = useTemplates(workspaceId, tab);
  const { createDocument } = useDocuments(workspaceId, "recent");

  const filtered = templates.map(templateRecordToUi);

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
    <div className={`templates-view ${selected ? "templates-view--panel-open" : ""}`}>
      <div className="templates-view__scroll overlay-scrollbar">
        <div className="templates-view__inner">
          <div className="templates-toolbar">
            <SegmentedControl
              options={[
                { value: "all", label: "All" },
                { value: "mine", label: "Mine" },
              ]}
              value={tab}
              onChange={setTab}
            />
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

          {loading ? (
            <LoaderState
              label="Loading templates…"
              size="s"
              className="templates-view__status"
            />
          ) : error ? (
            <p className="caption templates-view__status">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="caption templates-view__status">No templates found.</p>
          ) : (
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
          )}
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
  );
}
