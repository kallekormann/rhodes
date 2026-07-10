export type ScopeType = "private" | "team";

export type ScopeRole = "owner" | "admin" | "member";

export type Scope = {
  id: string;
  name: string;
  type: ScopeType;
  role: ScopeRole;
};

export const initialScopes: Scope[] = [
  { id: "private", name: "Private", type: "private", role: "owner" },
  { id: "private-book", name: "Book Draft", type: "private", role: "owner" },
  { id: "private-research", name: "Research", type: "private", role: "owner" },
  { id: "team-growth", name: "Growth Engine", type: "team", role: "admin" },
  { id: "team-product", name: "Product", type: "team", role: "member" },
];

export const defaultScopeId = "private";

/** Team plan mock — gates "New team space" in switcher */
export const canCreateTeamSpace = true;

/** Personal spaces per plan (mock: Pro tier) */
export const personalSpaceLimit = 10;

export function canCreatePersonalSpace(scopes: Scope[]): boolean {
  const personalCount = scopes.filter((s) => s.type === "private").length;
  return personalCount < personalSpaceLimit;
}

export function createScopeId(type: ScopeType): string {
  const prefix = type === "private" ? "private" : "team";
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function getScopeLabel(scope: Scope): string {
  return scope.name;
}

export function getScopeMetaLabel(scope: Scope): string {
  if (scope.type === "private") return `Personal · ${scope.name}`;
  return `Team · ${scope.name}`;
}
