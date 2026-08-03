import type { ReactNode } from "react";
import type { Organization } from "@/data/organizations";
import type { Scope } from "@/data/scopes";
import type { OrgPickerGroup } from "@/lib/workspaces/scope-picker";
import { ScopeMenu } from "./ScopeMenu";
import { ScopeTrigger } from "./ScopeTrigger";
import "./ScopeSwitcherShowcase.css";

const demoPersonal: Scope[] = [
  { id: "demo-private", name: "Private", type: "private", role: "owner", orgId: null, createdAt: "2020-01-01T00:00:00.000Z", enabledViewsCount: 0, enabledViews: [] },
  { id: "demo-book", name: "Book Draft", type: "private", role: "owner", orgId: null, createdAt: "2020-01-02T00:00:00.000Z", enabledViewsCount: 0, enabledViews: [] },
];

const demoStandaloneTeams: Scope[] = [
  { id: "demo-growth", name: "Growth Engine", type: "team", role: "admin", orgId: null, createdAt: "2020-01-04T00:00:00.000Z", enabledViewsCount: 0, enabledViews: [] },
];

const demoOrgA: Organization = {
  id: "demo-org-a",
  name: "Acme Studio",
  role: "owner",
};

const demoOrgB: Organization = {
  id: "demo-org-b",
  name: "Client Corp",
  role: "member",
};

const demoOrgATeams: Scope[] = [
  { id: "demo-org-product", name: "Product", type: "team", role: "admin", orgId: demoOrgA.id, createdAt: "2020-01-05T00:00:00.000Z", enabledViewsCount: 0, enabledViews: [] },
  { id: "demo-org-marketing", name: "Marketing", type: "team", role: "member", orgId: demoOrgA.id, createdAt: "2020-01-06T00:00:00.000Z", enabledViewsCount: 0, enabledViews: [] },
];

const demoOrgBTeams: Scope[] = [
  { id: "demo-org-client", name: "Delivery", type: "team", role: "member", orgId: demoOrgB.id, createdAt: "2020-01-08T00:00:00.000Z", enabledViewsCount: 0, enabledViews: [] },
];

const multiOrgGroups: OrgPickerGroup[] = [
  { org: demoOrgA, teams: demoOrgATeams, collapsed: false },
  { org: demoOrgB, teams: demoOrgBTeams, collapsed: true },
];

type ShowcaseItem = {
  label: string;
  render: () => ReactNode;
};

export function ScopeSwitcherShowcase() {
  const items: ShowcaseItem[] = [
    {
      label: "Trigger — private scope",
      render: () => <ScopeTrigger scope={demoPersonal[0]} />,
    },
    {
      label: "Trigger — personal team",
      render: () => <ScopeTrigger scope={demoStandaloneTeams[0]} />,
    },
    {
      label: "Menu — private & teams only",
      render: () => (
        <ScopeMenu
          inline
          menuOpen
          userLabel="Alex Morgan"
          userId="demo-user"
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
      label: "Menu — multi-org (collapsible sections)",
      render: () => (
        <ScopeMenu
          inline
          menuOpen
          userLabel="Alex Morgan"
          userId="demo-user"
          personalPrivateScopes={demoPersonal}
          personalTeamScopes={demoStandaloneTeams}
          orgGroups={multiOrgGroups}
          activeScopeId="demo-org-client"
          canCreatePersonalSpace
          canCreateTeamSpace
          canCreateOrgTeam={() => true}
        />
      ),
    },
    {
      label: "Menu — org team active",
      render: () => (
        <ScopeMenu
          inline
          menuOpen
          userLabel="Alex Morgan"
          userId="demo-user"
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
      label: "Menu — private limit reached",
      render: () => (
        <ScopeMenu
          inline
          menuOpen
          userLabel="Alex Morgan"
          personalPrivateScopes={demoPersonal}
          personalTeamScopes={demoStandaloneTeams}
          orgGroups={[]}
          activeScopeId="demo-book"
          canCreatePersonalSpace={false}
          canCreateTeamSpace
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
