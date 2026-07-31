import { z } from "zod";
import { scopeCompositionBodySchema } from "@/lib/scope-composition/apply";

export const createWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    is_team_workspace: z.boolean().default(false),
    org_id: z.string().uuid().optional(),
    enabled_views: z.array(z.string().min(1)).optional().default([]),
    scope_composition: scopeCompositionBodySchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.scope_composition &&
      data.enabled_views &&
      data.enabled_views.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either scope_composition or enabled_views, not both.",
        path: ["enabled_views"],
      });
    }
  });

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
