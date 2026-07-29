import { z } from "zod";

/** Private scope policy — see docs/30-scope-settings-matrix.md */
export const privateScopePolicySchema = z.object({
  cross_private_sharing: z.enum(["isolated"]).default("isolated"),
  external_collaborators: z
    .enum(["disabled", "guests_only", "members_allowed"])
    .default("guests_only"),
  default_collaborator_role: z.enum(["viewer", "member"]).default("viewer"),
  collaborator_can_invite: z
    .enum(["false", "same_scope_only", "org_members_only", "anyone_with_link"])
    .default("false"),
  content_sharing_outbound: z
    .enum(["none", "documents", "documents_and_library"])
    .default("documents"),
});

export type PrivateScopePolicy = z.infer<typeof privateScopePolicySchema>;

/** Team scope policy */
export const teamScopePolicySchema = z.object({
  org_sharing: z
    .enum(["team_only", "all_org_teams", "selected_org_teams", "org_wide"])
    .default("team_only"),
  external_collaborators: z
    .enum(["disabled", "org_members_only", "guests_allowed"])
    .default("org_members_only"),
  default_member_role: z.enum(["member", "viewer"]).default("member"),
  default_guest_role: z.enum(["viewer"]).default("viewer"),
  collaborator_can_invite: z
    .enum([
      "false",
      "team_members_only",
      "org_members_only",
      "external_with_approval",
    ])
    .default("team_members_only"),
  content_sharing_outbound: z
    .enum([
      "none",
      "team_only",
      "selected_teams",
      "org_wide",
      "private_scopes",
    ])
    .default("team_only"),
  content_sharing_inbound: z
    .enum(["none", "org_teams_only", "linked_private", "any_member_private"])
    .default("org_teams_only"),
});

export type TeamScopePolicy = z.infer<typeof teamScopePolicySchema>;

/** Organization ceiling policy (`organizations.policy`) */
export const orgPolicySchema = z.object({
  guests_allowed: z.boolean().default(false),
  who_can_invite_guests: z
    .enum(["owner", "admin", "member", "request_approval"])
    .default("admin"),
  default_team_visibility: z.enum(["isolated", "org_catalog"]).default("isolated"),
  cross_team_content_default: z
    .enum(["none", "team_only", "org_wide", "selected_teams"])
    .default("team_only"),
  external_sharing_default: z
    .enum(["blocked", "document_only", "guest_allowed"])
    .default("document_only"),
  who_can_create_teams: z.enum(["owner", "admin", "org_member"]).default("admin"),
});

export type OrgPolicy = z.infer<typeof orgPolicySchema>;

export type ScopePolicy = PrivateScopePolicy | TeamScopePolicy;

export function defaultPrivateScopePolicy(): PrivateScopePolicy {
  return privateScopePolicySchema.parse({});
}

export function defaultTeamScopePolicy(): TeamScopePolicy {
  return teamScopePolicySchema.parse({});
}

export function defaultOrgPolicy(): OrgPolicy {
  return orgPolicySchema.parse({});
}

export function parseScopePolicyJson(
  isTeam: boolean,
  raw: unknown,
): ScopePolicy {
  if (isTeam) {
    return teamScopePolicySchema.parse(raw ?? {});
  }
  return privateScopePolicySchema.parse(raw ?? {});
}

export function mergeScopePolicyUpdate(
  isTeam: boolean,
  current: ScopePolicy,
  patch: Record<string, unknown>,
): ScopePolicy {
  if (isTeam) {
    return teamScopePolicySchema.parse({ ...current, ...patch });
  }
  return privateScopePolicySchema.parse({ ...current, ...patch });
}

export function mergeOrgPolicyUpdate(
  current: OrgPolicy,
  patch: Record<string, unknown>,
): OrgPolicy {
  return orgPolicySchema.parse({ ...current, ...patch });
}
