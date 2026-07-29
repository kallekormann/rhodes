import type { Organization } from "@/data/organizations";
import type { Scope } from "@/data/scopes";

export type OrgPickerGroup = {
  org: Organization;
  teams: Scope[];
  /** Solo-pro-as-org: use org name in header trigger when org has one team */
  collapsed: boolean;
};

export type ScopePickerPartition = {
  personalPrivateScopes: Scope[];
  personalTeamScopes: Scope[];
  orgGroups: OrgPickerGroup[];
};

export function partitionScopesForPicker(
  scopes: Scope[],
  organizations: Organization[],
): ScopePickerPartition {
  const personalPrivateScopes = scopes.filter((s) => s.type === "private");
  const personalTeamScopes = scopes.filter(
    (s) => s.type === "team" && !s.orgId,
  );

  const orgGroups = organizations
    .map((org) => {
      const teams = scopes.filter((s) => s.orgId === org.id);
      return {
        org,
        teams,
        collapsed: teams.length === 1,
      };
    })
    .sort((a, b) => a.org.name.localeCompare(b.org.name));

  return { personalPrivateScopes, personalTeamScopes, orgGroups };
}

export function findOrgForScope(
  scope: Scope,
  organizations: Organization[],
): Organization | null {
  if (!scope.orgId) return null;
  return organizations.find((org) => org.id === scope.orgId) ?? null;
}

export function isSoloProOrgScope(
  scope: Scope,
  partition: ScopePickerPartition,
): boolean {
  if (!scope.orgId) return false;
  const group = partition.orgGroups.find((g) => g.org.id === scope.orgId);
  return group?.collapsed === true && group.teams[0]?.id === scope.id;
}

export function scopeTriggerLabel(
  scope: Scope,
  organizations: Organization[],
  partition: ScopePickerPartition,
): string {
  if (isSoloProOrgScope(scope, partition)) {
    const org = findOrgForScope(scope, organizations);
    return org?.name ?? scope.name;
  }
  return scope.name;
}
