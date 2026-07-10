import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  supabase: z.boolean(),
  redis: z.boolean(),
});
