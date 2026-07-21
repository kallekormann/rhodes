"use client";

import { PanelRightClose } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AskPanel } from "@/components/AskPanel";
import { IconButton } from "@/components/IconButton";
import "@/components/RightPanel.css";
import "./GlobalAskPanel.css";

/**
 * Rhodes Ask shell for non-editor views (Documents, Library, future Dashboard).
 * ~50vw fixed overlay — does not squeeze page content. Editor keeps docked RightPanel.
 */
export function GlobalAskPanel() {
  const {
    view,
    panelOpen,
    panelTab,
    closePanel,
    workspaceId,
    activeScope,
  } = useApp();

  const visible = view !== "editor" && panelOpen && panelTab === "ask";

  return (
    <>
      {visible && (
        <button
          type="button"
          className="global-ask-scrim"
          aria-label="Close Ask"
          onClick={closePanel}
        />
      )}
      <aside
        className={`right-panel global-ask-panel ${visible ? "right-panel--open" : ""}`}
        aria-hidden={!visible}
        aria-label={visible ? `Ask about ${activeScope.name}` : undefined}
      >
        {visible && (
          <>
            <div className="right-panel__header">
              <div className="global-ask-panel__title">
                <span className="global-ask-panel__eyebrow">Rhodes</span>
                <span className="global-ask-panel__heading">
                  Ask about {activeScope.name}
                </span>
              </div>
              <IconButton
                icon={PanelRightClose}
                label="Close panel"
                onClick={closePanel}
                iconSize={18}
              />
            </div>
            <div className="right-panel__content overlay-scrollbar">
              <AskPanel workspaceId={workspaceId} />
            </div>
          </>
        )}
      </aside>
    </>
  );
}
