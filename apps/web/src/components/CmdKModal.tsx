"use client";

import {
  File,
  Files,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Input } from "./Input";
import "./CmdKModal.css";

const items = [
  { section: "Recent", icon: File, label: "Q3 Product Spec", action: "editor" as const },
  { section: "Actions", icon: Plus, label: "New document", action: "editor" as const },
  { section: "Actions", icon: Upload, label: "Import file", action: "library" as const },
  { section: "Actions", icon: Files, label: "Open documents", action: "documents" as const },
  { section: "Actions", icon: Sparkles, label: "Ask about workspace", action: "ask" as const },
];

export function CmdKModal() {
  const { cmdKOpen, closeCmdK, setView, openPanel, createNewDocument } = useApp();

  if (!cmdKOpen) return null;

  const handleAction = (item: (typeof items)[number]) => {
    closeCmdK();
    if (item.label === "New document") {
      void createNewDocument();
      return;
    }
    if (item.action === "editor") setView("editor");
    else if (item.action === "documents") setView("documents");
    else if (item.action === "library") setView("library");
    else if (item.action === "ask") {
      setView("editor");
      openPanel("ask");
    }
  };

  let lastSection = "";

  return (
    <div className="cmdk-overlay" onClick={closeCmdK} role="presentation">
      <div
        className="cmdk-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <Input
          placeholder="Search or type a command…"
          icon={<Search size={18} strokeWidth={1.75} />}
          hint="⌘K"
        />
        <ul className="cmdk-list">
          {items.map((item) => {
            const showSection = item.section !== lastSection;
            lastSection = item.section;
            const Icon = item.icon;
            return (
              <li key={item.label}>
                {showSection && (
                  <div className="cmdk-list__section">{item.section}</div>
                )}
                <button
                  type="button"
                  className="cmdk-list__item"
                  onClick={() => handleAction(item)}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
