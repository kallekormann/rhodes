"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Scope } from "@/data/scopes";
import { useApp } from "@/context/AppContext";
import { ScopeMenu } from "./ScopeMenu";
import { ScopeTrigger } from "./ScopeTrigger";
import { ScopeCreateWizard } from "./ScopeCreateWizard";
import "./ScopeSwitcher.css";

type CreateKind = "personal" | "team" | null;

export function ScopeSwitcher() {
  const {
    activeScope,
    scopes,
    session,
    setActiveScope,
    createPersonalSpace,
    createTeamSpace,
    canCreatePersonalSpace,
    canCreateTeamSpace,
  } = useApp();
  const router = useRouter();
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

  const handleCreate = (input: { name: string; enabledViews: string[] }) => {
    if (createKind === "personal") createPersonalSpace(input.name, input.enabledViews);
    if (createKind === "team") createTeamSpace(input.name, input.enabledViews);
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
            userLabel={session.displayName}
            userId={session.userId}
            userAvatarUrl={session.avatarUrl}
            canCreatePersonalSpace={canCreatePersonalSpace}
            canCreateTeamSpace={canCreateTeamSpace}
            onSelect={selectScope}
            onCreatePersonal={() => openCreate("personal")}
            onCreateTeam={() => openCreate("team")}
            onManage={() => {
              setOpen(false);
              const section = activeScope.type === "team" ? "Team" : "Scopes";
              router.push(`/settings?mode=scope&section=${section}`);
            }}
          />
        )}
      </div>

      <ScopeCreateWizard
        open={createKind === "personal"}
        kind="personal"
        onClose={() => setCreateKind(null)}
        onSubmit={handleCreate}
      />
      <ScopeCreateWizard
        open={createKind === "team"}
        kind="team"
        onClose={() => setCreateKind(null)}
        onSubmit={handleCreate}
      />
    </>
  );
}
