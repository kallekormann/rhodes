import { PanelRightClose } from "lucide-react";
import type { Template } from "../data/templates";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { NeutralPill } from "./NeutralPill";
import "./TemplateDetailPanel.css";

type TemplateDetailPanelProps = {
  template: Template | null;
  onClose: () => void;
  onUse: (template: Template) => void;
};

export function TemplateDetailPanel({
  template,
  onClose,
  onUse,
}: TemplateDetailPanelProps) {
  const isOpen = template !== null;

  return (
    <aside
      className={`template-detail ${isOpen ? "template-detail--open" : ""}`}
      aria-hidden={!isOpen}
    >
      {template && (
        <>
          <div className="template-detail__header">
            <h2 className="template-detail__title">{template.name}</h2>
            <IconButton
              icon={PanelRightClose}
              label="Close"
              onClick={onClose}
              iconSize={18}
            />
          </div>

          <div className="template-detail__content overlay-scrollbar">
            <section className="template-detail__section">
              <h3>Description</h3>
              <p className="template-detail__body">{template.fullDescription}</p>
            </section>

            <section className="template-detail__section">
              <h3>Use cases</h3>
              <ul className="template-detail__use-cases">
                {template.useCases.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            {template.properties && template.properties.length > 0 && (
              <section className="template-detail__section">
                <h3>Properties</h3>
                <div className="template-detail__pills">
                  {template.properties.map((prop) => (
                    <NeutralPill key={prop.label}>
                      {prop.label}: {prop.value}
                    </NeutralPill>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="template-detail__actionbar">
            <Button onClick={() => onUse(template)}>Use</Button>
          </div>
        </>
      )}
    </aside>
  );
}
