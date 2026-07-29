export type OrganizationRole = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  role: OrganizationRole;
};

export function canManageOrgTeams(org: Organization): boolean {
  return org.role === "owner" || org.role === "admin";
}
