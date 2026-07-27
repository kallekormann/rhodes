import { z } from "zod";

export const sharePermissionSchema = z.enum(["read", "edit"]);

export const createShareSchema = z.object({
  grantee_type: z.enum(["user", "workspace"]),
  grantee_id: z.string().min(1),
  label: z.string().trim().min(1),
  permission: sharePermissionSchema.optional().default("edit"),
  /** Default true for edit shares; ignored for read shares. */
  offline_editing_allowed: z.boolean().optional(),
});

export const updateShareSchema = z
  .object({
    share_id: z.string().uuid(),
    permission: sharePermissionSchema.optional(),
    offline_editing_allowed: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.permission !== undefined || value.offline_editing_allowed !== undefined,
    { message: "permission or offline_editing_allowed required" },
  );

export type SharePermission = z.infer<typeof sharePermissionSchema>;
export type CreateShareInput = z.infer<typeof createShareSchema>;
export type UpdateShareInput = z.infer<typeof updateShareSchema>;

export function resolveOfflineEditingAllowedForShare(
  permission: SharePermission,
  requested: boolean | undefined,
): boolean {
  if (permission === "read") return false;
  return requested ?? true;
}

export function buildSharePatch(input: UpdateShareInput): {
  permission?: SharePermission;
  offline_editing_allowed?: boolean;
} {
  const patch: {
    permission?: SharePermission;
    offline_editing_allowed?: boolean;
  } = {};

  if (input.permission !== undefined) {
    patch.permission = input.permission;
    if (input.permission === "read") {
      patch.offline_editing_allowed = false;
    } else if (input.offline_editing_allowed === undefined) {
      patch.offline_editing_allowed = true;
    }
  }

  if (input.offline_editing_allowed !== undefined) {
    patch.offline_editing_allowed = input.offline_editing_allowed;
  }

  return patch;
}
