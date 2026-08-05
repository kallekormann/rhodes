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
 * Scope-level Rhodes Ask (~50vw overlay). Opened from Cmd+K
 * "Ask about {scope}" — independent of the document editor's docked Ask tab.
 */
export function GlobalAskPanel() {
  const [mounted, setMounted] = useState(false);
  const {
    globalAskOpen,
    closeGlobalAsk,
    workspaceId,
    activeScope,
  } = useApp();
  const { online } = useOnlineStatus(workspaceId);

  useEffect(() => {
    setMounted(true);
  }, []);

  const visible = globalAskOpen;

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
                onClick={closeGlobalAsk}
                iconSize={18}
              />
            </div>
            <div className="right-panel__content overlay-scrollbar">
              {online ? (
                <AskPanel workspaceId={workspaceId} />
              ) : (
                <OfflineUnavailable
                  title="Ask offline"
                  message="Connect to use Ask."
                />
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
