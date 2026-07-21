"use client";

import {
  BookOpen,
  ChevronRight,
  CircleUser,
  Ellipsis,
  Files,
  Moon,
  Palette,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp, type AppView } from "@/context/AppContext";
import { UserAvatar } from "@/components/UserAvatar";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { IconButton } from "./IconButton";
import "./AppHeader.css";

function HeaderTrail({
  view,
  documentTitle,
  onNavigate,
}: {
  view: AppView;
  documentTitle: string;
  onNavigate: (view: AppView) => void;
}) {
  if (view === "documents") {
    return <span className="app-header__context-label">Overview</span>;
  }

  if (view === "templates") {
    return (
      <>
        <button
          type="button"
          className="app-header__breadcrumb-link"
          onClick={() => onNavigate("documents")}
        >
          Overview
        </button>
        <ChevronRight size={14} strokeWidth={1.75} className="app-header__breadcrumb-sep" />
        <span className="app-header__context-label">Templates</span>
      </>
    );
  }

  if (view === "editor") {
    return (
      <>
        <button
          type="button"
          className="app-header__breadcrumb-link"
          onClick={() => onNavigate("documents")}
        >
          Overview
        </button>
        <ChevronRight size={14} strokeWidth={1.75} className="app-header__breadcrumb-sep" />
        <span className="app-header__title" title={documentTitle}>
          {documentTitle}
        </span>
      </>
    );
  }

  if (view === "library") {
    return <span className="app-header__context-label">Library</span>;
  }

  if (view === "settings") {
    return <span className="app-header__context-label">Settings</span>;
  }

  if (view === "sticker-sheet") {
    return <span className="app-header__context-label">Design System</span>;
  }

  return null;
}

type OverflowItem = {
  id: string;
  label: string;
  icon: typeof BookOpen;
  active?: boolean;
  onClick: () => void;
};

function HeaderOverflowMenu({ items }: { items: OverflowItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="header-overflow" ref={rootRef}>
      <IconButton
        icon={Ellipsis}
        label="More actions"
        className="header-overflow__trigger"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="header-overflow__menu" role="menu">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`header-overflow__item ${item.active ? "header-overflow__item--active" : ""}`}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  const {
    view,
    setView,
    toggleTheme,
    theme,
    openCmdK,
    headerHidden,
    setHeaderHidden,
    documentTitle,
    createNewDocument,
    canWriteActiveScope,
    session,
  } = useApp();
  const router = useRouter();

  const openUserSettings = () => {
    router.push("/settings?mode=user");
  };

  const isEditor = view === "editor";
  const isHidden = isEditor && headerHidden;
  const isDocumentsSection = view === "documents" || view === "templates" || view === "editor";

  const overflowItems: OverflowItem[] = [
    {
      id: "library",
      label: "Library",
      icon: BookOpen,
      active: view === "library",
      onClick: () => setView("library"),
    },
    {
      id: "profile",
      label: "Profile & settings",
      icon: CircleUser,
      active: view === "settings",
      onClick: openUserSettings,
    },
    {
      id: "theme",
      label: theme === "light" ? "Dark mode" : "Light mode",
      icon: theme === "light" ? Moon : Sun,
      onClick: toggleTheme,
    },
    {
      id: "sticker",
      label: "Design system",
      icon: Palette,
      active: view === "sticker-sheet",
      onClick: () => setView("sticker-sheet"),
    },
  ];

  return (
    <>
      {isHidden && (
        <div
          className="header-reveal-zone"
          onMouseEnter={() => setHeaderHidden(false)}
          aria-hidden="true"
        />
      )}
      <header
        className={`app-header ${isEditor ? "app-header--overlay" : ""} ${isHidden ? "app-header--hidden" : ""}`}
        onMouseEnter={() => {
          if (isEditor) setHeaderHidden(false);
        }}
      >
        <div className="app-header__zone app-header__zone--left">
          <nav className="app-header__context" aria-label="Context">
            <ScopeSwitcher />
            <span className="app-header__sep" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              className={`nav-link ${isDocumentsSection ? "nav-link--active" : ""}`}
              onClick={() => setView("documents")}
            >
              <Files size={18} strokeWidth={1.75} />
              <span className="nav-link__label">Documents</span>
            </button>
            <span className="app-header__sep app-header__sep--trail" aria-hidden="true">
              ·
            </span>
            <div className="app-header__trail">
              <HeaderTrail
                view={view}
                documentTitle={documentTitle}
                onNavigate={setView}
              />
            </div>
          </nav>
        </div>

        <div className="app-header__zone app-header__zone--right">
          <IconButton icon={Search} label="Search" onClick={openCmdK} />
          {canWriteActiveScope ? (
            <IconButton
              icon={Plus}
              label="New document"
              onClick={() => void createNewDocument()}
            />
          ) : null}
          <IconButton
            icon={BookOpen}
            label="Library"
            active={view === "library"}
            className="app-header__action--collapsible"
            onClick={() => setView("library")}
          />
          <button
            type="button"
            className="icon-btn icon-btn--default profile-menu-btn app-header__action--collapsible"
            aria-label="Profile & settings"
            title="Profile & settings"
            onClick={openUserSettings}
          >
            <UserAvatar
              name={session.displayName}
              userId={session.userId}
              src={session.avatarUrl}
              size="sm"
            />
          </button>
          <IconButton
            icon={theme === "light" ? Moon : Sun}
            label="Toggle theme"
            className="app-header__action--collapsible"
            onClick={toggleTheme}
          />
          <IconButton
            icon={Palette}
            label="Design system"
            active={view === "sticker-sheet"}
            className="app-header__action--collapsible"
            onClick={() => setView("sticker-sheet")}
          />
          <HeaderOverflowMenu items={overflowItems} />
        </div>
      </header>
    </>
  );
}
