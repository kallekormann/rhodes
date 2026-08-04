"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PanelRightClose } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { IconButton } from "@/components/IconButton";
import { OfflineUnavailable } from "@/components/OfflineUnavailable";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import "@/components/RightPanel.css";
import "./GlobalAskPanel.css";

const AskPanel = dynamic(
  () => import("@/components/AskPanel").then((m) => ({ default: m.AskPanel })),
  { ssr: false },
);

/**
 * Rhodes Ask shell for non-editor views (Documents, Library, future Dashboard).
 * ~50vw fixed overlay — does not squeeze page content. Editor keeps docked RightPanel.
 */
export function GlobalAskPanel() {
  const [mounted, setMounted] = useState(false);
  const {
    view,
    panelOpen,
    panelTab,
    closePanel,
    workspaceId,
    activeScope,
  } = useApp();
  const { online } = useOnlineStatus(workspaceId);

  useEffect(() => {
    setMounted(true);
  }, []);

  const visible = view !== "editor" && panelOpen && panelTab === "ask";

  if (!mounted) {
    return null;
  }

  return (
    <>
      {visible && <div className="global-ask-scrim" aria-hidden="true" />}
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
              {online ? (
                <AskPanel workspaceId={workspaceId} />
              ) : (
                <OfflineUnavailable
                  title="Ask unavailable offline"
                  message="Rhodes Ask needs an internet connection."
                />
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
