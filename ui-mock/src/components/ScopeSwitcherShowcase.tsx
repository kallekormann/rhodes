import type { ReactNode } from "react";
import type { Scope } from "../data/scopes";
import { ScopeMenu } from "./ScopeMenu";
import { ScopeTrigger } from "./ScopeTrigger";
import "./ScopeSwitcherShowcase.css";

const demoPersonal: Scope[] = [
  { id: "demo-private", name: "Private", type: "private", role: "owner" },
  { id: "demo-book", name: "Book Draft", type: "private", role: "owner" },
  { id: "demo-research", name: "Research", type: "private", role: "owner" },
];

const demoTeam: Scope[] = [
  { id: "demo-growth", name: "Growth Engine", type: "team", role: "admin" },
  { id: "demo-product", name: "Product", type: "team", role: "member" },
];

type ShowcaseItem = {
  label: string;
  render: () => ReactNode;
};

export function ScopeSwitcherShowcase() {
  const items: ShowcaseItem[] = [
    {
      label: "Trigger — personal, closed",
      render: () => <ScopeTrigger scope={demoPersonal[0]} />,
    },
    {
      label: "Trigger — team, closed",
      render: () => <ScopeTrigger scope={demoTeam[0]} />,
    },
    {
      label: "Trigger — personal, open",
      render: () => <ScopeTrigger scope={demoPersonal[0]} open />,
    },
    {
      label: "Trigger — team, open",
      render: () => <ScopeTrigger scope={demoTeam[0]} open />,
    },
    {
      label: "Menu — personal active",
      render: () => (
        <ScopeMenu
          inline
          personalScopes={demoPersonal}
          teamScopes={demoTeam}
          activeScopeId="demo-private"
        />
      ),
    },
    {
      label: "Menu — team active",
      render: () => (
        <ScopeMenu
          inline
          personalScopes={demoPersonal}
          teamScopes={demoTeam}
          activeScopeId="demo-growth"
        />
      ),
    },
    {
      label: "Menu — book draft active",
      render: () => (
        <ScopeMenu
          inline
          personalScopes={demoPersonal}
          teamScopes={demoTeam}
          activeScopeId="demo-book"
        />
      ),
    },
    {
      label: "Menu — can create both",
      render: () => (
        <ScopeMenu
          inline
          personalScopes={demoPersonal}
          teamScopes={demoTeam}
          activeScopeId="demo-private"
          canCreatePersonalSpace
          canCreateTeamSpace
        />
      ),
    },
    {
      label: "Menu — personal limit reached",
      render: () => (
        <ScopeMenu
          inline
          personalScopes={demoPersonal}
          teamScopes={demoTeam}
          activeScopeId="demo-research"
          canCreatePersonalSpace={false}
          canCreateTeamSpace
        />
      ),
    },
    {
      label: "Menu — team plan required",
      render: () => (
        <ScopeMenu
          inline
          personalScopes={demoPersonal}
          teamScopes={demoTeam}
          activeScopeId="demo-private"
          canCreatePersonalSpace
          canCreateTeamSpace={false}
        />
      ),
    },
    {
      label: "Menu — no team spaces",
      render: () => (
        <ScopeMenu
          inline
          personalScopes={[demoPersonal[0]]}
          teamScopes={[]}
          activeScopeId="demo-private"
        />
      ),
    },
    {
      label: "Menu — minimal (1 personal, 0 team)",
      render: () => (
        <ScopeMenu
          inline
          personalScopes={[demoPersonal[0]]}
          teamScopes={[]}
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
