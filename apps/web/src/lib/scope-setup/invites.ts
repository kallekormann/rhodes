import type { PendingTeamInvite } from "@/components/ScopeSetupWizard";
import type { InviteRow } from "@/components/scope-setup/ScopeTeamInviteStep";

export type ResolvedInvite = {
  key: string;
  label: string;
  email: string;
  role: string;
};

const ROLE_LABELS: Record<PendingTeamInvite["role"], string> = {
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export function formatInviteRole(role: PendingTeamInvite["role"]): string {
  return ROLE_LABELS[role];
}

/** Valid, deduped invites for preview and summary. */
export function resolvedInvites(rows: InviteRow[]): ResolvedInvite[] {
  const seen = new Set<string>();
  const members: ResolvedInvite[] = [];

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    members.push({
      key: row.key,
      label: row.label?.trim() || email,
      email,
      role: formatInviteRole(row.role),
    });
  }

  return members;
}

export function isValidInviteEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return email.length > 0 && email.includes("@") && email.includes(".");
}
