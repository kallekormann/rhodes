import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  is_team_workspace: z.boolean().default(false),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
