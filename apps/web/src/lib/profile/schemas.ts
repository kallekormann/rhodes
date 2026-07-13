import { z } from "zod";

export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(80).optional(),
  email_preferences: z
    .object({
      knowledge_bridge: z.boolean().optional(),
    })
    .optional(),
});
