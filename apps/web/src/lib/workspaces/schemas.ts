import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  is_team_workspace: z.boolean().default(false),
  enabled_views: z.array(z.string().min(1)).optional().default([]),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
