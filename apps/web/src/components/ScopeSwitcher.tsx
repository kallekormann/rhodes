"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Scope } from "@/data/scopes";
import type { Organization } from "@/data/organizations";
import { canManageOrgTeams } from "@/data/organizations";
import { useApp } from "@/context/AppContext";
import { partitionScopesForPicker } from "@/lib/workspaces/scope-picker";
import { ScopeMenu } from "./ScopeMenu";
import { ScopeTrigger } from "./ScopeTrigger";
import { ScopeCreateWizard } from "./ScopeCreateWizard";
import "./ScopeSwitcher.css";

type CreateKind = "personal" | "team" | "org-team" | null;

export function ScopeSwitcher() {
  const {
    activeScope,
    scopes,
    organizations,
    session,
    featureGates,
    setActiveScope,
    createPersonalSpace,
    createTeamSpace,
    canCreatePersonalSpace,
    canCreateTeamSpace,
  } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [createOrgTarget, setCreateOrgTarget] = useState<Organization | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const partition = useMemo(
    () => partitionScopesForPicker(scopes, organizations),
    [scopes, organizations],
  );

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

  const openCreate = (kind: CreateKind, org?: Organization) => {
    setOpen(false);
    setCreateKind(kind);
    setCreateOrgTarget(org ?? null);
  };

  const handleCreate = async (input: {
    name: string;
    scopeComposition: import("@/lib/scope-composition/apply").ScopeCompositionBody;
    pendingInvites?: import("@/components/ScopeSetupWizard").PendingTeamInvite[];
  }) => {
    if (createKind === "personal") {
      return createPersonalSpace(input.name, input.scopeComposition);
    }
    if (createKind === "team") {
      return createTeamSpace(
        input.name,
        input.scopeComposition,
        null,
        input.pendingInvites,
      );
    }
    if (createKind === "org-team") {
      return createTeamSpace(
        input.name,
        input.scopeComposition,
        createOrgTarget?.id ?? null,
        input.pendingInvites,
      );
    }
    return false;
  };

  const canCreateOrgTeam = (org: Organization) =>
    featureGates.can("org.create") && canManageOrgTeams(org);

  return (
    <>
      <div className="scope-switcher" ref={rootRef}>
        <ScopeTrigger
          scope={activeScope}
          organizations={organizations}
          partition={partition}
          open={open}
          onClick={() => setOpen((v) => !v)}
        />

        {open && (
          <ScopeMenu
            personalPrivateScopes={partition.personalPrivateScopes}
            personalTeamScopes={partition.personalTeamScopes}
            orgGroups={partition.orgGroups}
            activeScopeId={activeScope.id}
            menuOpen={open}
            userLabel={session.displayName}
            userId={session.userId}
            userAvatarUrl={session.avatarUrl}
            canCreatePersonalSpace={canCreatePersonalSpace}
            canCreateTeamSpace={canCreateTeamSpace}
            canCreateOrgTeam={canCreateOrgTeam}
            onSelect={selectScope}
            onCreatePersonal={() => openCreate("personal")}
            onCreateTeam={() => openCreate("team")}
            onCreateOrgTeam={(org) => openCreate("org-team", org)}
            onManage={() => {
              setOpen(false);
              let section = "Scopes";
              if (activeScope.orgId) {
                section = "Organization";
              } else if (activeScope.type === "team") {
                section = "Team";
              }
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
        open={createKind === "team" || createKind === "org-team"}
        kind="team"
        onClose={() => {
          setCreateKind(null);
          setCreateOrgTarget(null);
        }}
        onSubmit={handleCreate}
      />
    </>
  );
}
