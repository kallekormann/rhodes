import type { ReactNode } from "react";
import type { Organization } from "@/data/organizations";
import type { Scope } from "@/data/scopes";
import type { OrgPickerGroup } from "@/lib/workspaces/scope-picker";
import { ScopeMenu } from "./ScopeMenu";
import { ScopeTrigger } from "./ScopeTrigger";
import "./ScopeSwitcherShowcase.css";

const demoPersonal: Scope[] = [
  { id: "demo-private", name: "Private", type: "private", role: "owner", orgId: null, createdAt: "2020-01-01T00:00:00.000Z", enabledViewsCount: 0 },
  { id: "demo-book", name: "Book Draft", type: "private", role: "owner", orgId: null, createdAt: "2020-01-02T00:00:00.000Z", enabledViewsCount: 0 },
  { id: "demo-research", name: "Research", type: "private", role: "owner", orgId: null, createdAt: "2020-01-03T00:00:00.000Z", enabledViewsCount: 0 },
];

const demoStandaloneTeams: Scope[] = [
  { id: "demo-growth", name: "Growth Engine", type: "team", role: "admin", orgId: null, createdAt: "2020-01-04T00:00:00.000Z", enabledViewsCount: 0 },
];

const demoOrg: Organization = {
  id: "demo-org",
  name: "Acme Studio",
  role: "owner",
};

const demoOrgTeams: Scope[] = [
  { id: "demo-org-product", name: "Product", type: "team", role: "admin", orgId: demoOrg.id, createdAt: "2020-01-05T00:00:00.000Z", enabledViewsCount: 0 },
  { id: "demo-org-marketing", name: "Marketing", type: "team", role: "member", orgId: demoOrg.id, createdAt: "2020-01-06T00:00:00.000Z", enabledViewsCount: 0 },
];

const demoSoloOrg: Organization = {
  id: "demo-solo-org",
  name: "Solo Pro LLC",
  role: "owner",
};

const demoSoloOrgTeam: Scope = {
  id: "demo-solo-team",
  name: "Main",
  type: "team",
  role: "owner",
  orgId: demoSoloOrg.id,
  createdAt: "2020-01-07T00:00:00.000Z",
  enabledViewsCount: 0,
};

const multiOrgGroups: OrgPickerGroup[] = [
  { org: demoOrg, teams: demoOrgTeams, collapsed: false },
];

const soloOrgGroups: OrgPickerGroup[] = [
  { org: demoSoloOrg, teams: [demoSoloOrgTeam], collapsed: true },
];

type ShowcaseItem = {
  label: string;
  render: () => ReactNode;
};

export function ScopeSwitcherShowcase() {
  const items: ShowcaseItem[] = [
    {
      label: "Trigger — personal",
      render: () => <ScopeTrigger scope={demoPersonal[0]} />,
    },
    {
      label: "Trigger — standalone team",
      render: () => <ScopeTrigger scope={demoStandaloneTeams[0]} />,
    },
    {
      label: "Trigger — solo-pro org (collapsed)",
      render: () => (
        <ScopeTrigger
          scope={demoSoloOrgTeam}
          organizations={[demoSoloOrg]}
          partition={{
            personalPrivateScopes: demoPersonal,
            personalTeamScopes: demoStandaloneTeams,
            orgGroups: soloOrgGroups,
          }}
        />
      ),
    },
    {
      label: "Menu — personal + standalone teams",
      render: () => (
        <ScopeMenu
          inline
          personalPrivateScopes={demoPersonal}
          personalTeamScopes={demoStandaloneTeams}
          orgGroups={[]}
          activeScopeId="demo-private"
          canCreatePersonalSpace
          canCreateTeamSpace
        />
      ),
    },
    {
      label: "Menu — with organization teams",
      render: () => (
        <ScopeMenu
          inline
          personalPrivateScopes={demoPersonal}
          personalTeamScopes={demoStandaloneTeams}
          orgGroups={multiOrgGroups}
          activeScopeId="demo-org-product"
          canCreatePersonalSpace
          canCreateTeamSpace
          canCreateOrgTeam={() => true}
        />
      ),
    },
    {
      label: "Menu — solo-pro org (one team)",
      render: () => (
        <ScopeMenu
          inline
          personalPrivateScopes={demoPersonal}
          personalTeamScopes={[]}
          orgGroups={soloOrgGroups}
          activeScopeId="demo-solo-team"
          canCreatePersonalSpace
          canCreateTeamSpace={false}
        />
      ),
    },
    {
      label: "Menu — personal limit reached",
      render: () => (
        <ScopeMenu
          inline
          personalPrivateScopes={demoPersonal}
          personalTeamScopes={demoStandaloneTeams}
          orgGroups={[]}
          activeScopeId="demo-research"
          canCreatePersonalSpace={false}
          canCreateTeamSpace
        />
      ),
    },
    {
      label: "Menu — minimal (1 personal, 0 team)",
      render: () => (
        <ScopeMenu
          inline
          personalPrivateScopes={[demoPersonal[0]]}
          personalTeamScopes={[]}
          orgGroups={[]}
          activeScopeId="demo-private"
          canCreatePersonalSpace
          canCreateTeamSpace={false}
        />
      ),
    },
  ];

  return (
    <div className="scope-showcase">
      {items.map((item) => (
        <div key={item.label} className="scope-showcase__item">
          <span className="scope-showcase__label">{item.label}</span>
          <div className="scope-showcase__content">{item.render()}</div>
        </div>
      ))}
    </div>
  );
}
