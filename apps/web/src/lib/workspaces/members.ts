import { z } from "zod";
import type { AssignableTeamRole } from "@rhodes/shared/team-roles";

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

export type WorkspaceMemberRole = "owner" | "admin" | "member" | "viewer";

export type WorkspaceMember = {
  user_id: string;
  display_name: string;
  role: WorkspaceMemberRole;
};

export type WorkspacePendingInvite = {
  id: string;
  email: string;
  role: AssignableTeamRole;
  expires_at: string;
  created_at: string;
};
