export type ScopeType = "private" | "team";

export type ScopeRole = "owner" | "admin" | "member" | "viewer";

export type Scope = {
  id: string;
  name: string;
  type: ScopeType;
  role: ScopeRole;
  createdAt: string;
};

export const initialScopes: Scope[] = [
  {
    id: "private",
    name: "Private",
    type: "private",
    role: "owner",
    createdAt: "2020-01-01T00:00:00.000Z",
  },
  {
    id: "private-book",
    name: "Book Draft",
    type: "private",
    role: "owner",
    createdAt: "2020-01-02T00:00:00.000Z",
  },
  {
    id: "private-research",
    name: "Research",
    type: "private",
    role: "owner",
    createdAt: "2020-01-03T00:00:00.000Z",
  },
  {
    id: "team-growth",
    name: "Growth Engine",
    type: "team",
    role: "admin",
    createdAt: "2020-01-04T00:00:00.000Z",
  },
  {
    id: "team-product",
    name: "Product",
    type: "team",
    role: "member",
    createdAt: "2020-01-05T00:00:00.000Z",
  },
];

export const defaultScopeId = "private";

import type { BillingTier } from "@rhodes/shared/tiers";
import { getTierLimits } from "@rhodes/shared/tiers";

/** Team plan — gated via billing tier in Phase 11 */
export function canCreateTeamSpace(tier: BillingTier = "pro"): boolean {
  return getTierLimits(tier).teamScopes > 0;
}

/** Personal scopes per billing tier */
export function personalSpaceLimit(tier: BillingTier = "pro"): number {
  const limit = getTierLimits(tier).personalScopes;
  return Number.isFinite(limit) ? limit : Number.POSITIVE_INFINITY;
}

export function canCreatePersonalSpace(
  scopes: Scope[],
  tier: BillingTier = "pro",
): boolean {
  const personalCount = scopes.filter((s) => s.type === "private").length;
  const limit = personalSpaceLimit(tier);
  return personalCount < limit;
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
