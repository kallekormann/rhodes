"use client";

import { useEffect, useRef, useState } from "react";
import { type Scope } from "@/data/scopes";
import { useApp } from "@/context/AppContext";
import { ScopeMenu } from "./ScopeMenu";
import { ScopeTrigger } from "./ScopeTrigger";
import { SpaceCreateModal } from "./SpaceCreateModal";
import "./ScopeSwitcher.css";

type CreateKind = "personal" | "team" | null;

export function ScopeSwitcher() {
  const {
    activeScope,
    scopes,
    setActiveScope,
    setView,
    createPersonalSpace,
    createTeamSpace,
    canCreatePersonalSpace,
    canCreateTeamSpace,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const personalScopes = scopes.filter((s) => s.type === "private");
  const teamScopes = scopes.filter((s) => s.type === "team");

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

  const selectScope = (scope: Scope) => {
    setActiveScope(scope.id);
    setOpen(false);
  };

  const openCreate = (kind: CreateKind) => {
    setOpen(false);
    setCreateKind(kind);
  };

  const handleCreate = (name: string) => {
    if (createKind === "personal") createPersonalSpace(name);
    if (createKind === "team") createTeamSpace(name);
    setCreateKind(null);
  };

  return (
    <>
      <div className="scope-switcher" ref={rootRef}>
        <ScopeTrigger
          scope={activeScope}
          open={open}
          onClick={() => setOpen((v) => !v)}
        />

        {open && (
          <ScopeMenu
            personalScopes={personalScopes}
            teamScopes={teamScopes}
            activeScopeId={activeScope.id}
            canCreatePersonalSpace={canCreatePersonalSpace}
            canCreateTeamSpace={canCreateTeamSpace}
            onSelect={selectScope}
            onCreatePersonal={() => openCreate("personal")}
            onCreateTeam={() => openCreate("team")}
            onManage={() => {
              setOpen(false);
              setView("settings");
            }}
          />
        )}
      </div>

      <SpaceCreateModal
        open={createKind === "personal"}
        title="New personal space"
        placeholder="e.g. Book draft, Research notes"
        onClose={() => setCreateKind(null)}
        onSubmit={handleCreate}
      />
      <SpaceCreateModal
        open={createKind === "team"}
        title="New team space"
        placeholder="e.g. Growth Engine"
        onClose={() => setCreateKind(null)}
        onSubmit={handleCreate}
      />
    </>
  );
}
