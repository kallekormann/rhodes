import { useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { templates, type Template } from "../data/templates";
import { SegmentedControl } from "../components/SegmentedControl";
import { TemplateDetailPanel } from "../components/TemplateDetailPanel";
import { IconLabelButton } from "../components/IconLabelButton";
import "./TemplatesView.css";

type TemplateTab = "all" | "mine";

export function TemplatesView() {
  const { setView, setDocumentTitle, setDocumentId } = useApp();
  const [tab, setTab] = useState<TemplateTab>("all");
  const [selected, setSelected] = useState<Template | null>(null);

  const filtered =
    tab === "mine" ? templates.filter((t) => t.mine) : templates;

  const handleUse = (template: Template) => {
    setDocumentId(`from-template-${template.id}`);
    setDocumentTitle(template.name);
    setView("editor");
    setSelected(null);
  };

  return (
    <div className={`templates-view ${selected ? "templates-view--panel-open" : ""}`}>
      <div className="templates-view__main overlay-scrollbar">
        <div className="templates-view__layout">
          <div className="templates-toolbar">
            <SegmentedControl
              options={[
                { value: "all", label: "All" },
                { value: "mine", label: "Mine" },
              ]}
              value={tab}
              onChange={setTab}
            />
            <IconLabelButton variant="ghost" icon={Plus}>
              Create template
            </IconLabelButton>
          </div>

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
                    <span className="template-list__desc">{template.shortDescription}</span>
                  </div>
                  {template.mine && <span className="template-list__badge">Mine</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <TemplateDetailPanel
        template={selected}
        onClose={() => setSelected(null)}
        onUse={handleUse}
      />
    </div>
  );
}
