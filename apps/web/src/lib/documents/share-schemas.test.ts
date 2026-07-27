import { describe, expect, it } from "vitest";
import {
  buildSharePatch,
  createShareSchema,
  resolveOfflineEditingAllowedForShare,
  updateShareSchema,
} from "@/lib/documents/share-schemas";

describe("share-schemas", () => {
  it("defaults offline editing on for new edit shares", () => {
    const parsed = createShareSchema.parse({
      grantee_type: "user",
      grantee_id: "user-2",
      label: "Teammate",
      permission: "edit",
    });
    expect(
      resolveOfflineEditingAllowedForShare(parsed.permission, parsed.offline_editing_allowed),
    ).toBe(true);
  });

  it("forces offline editing off for read shares", () => {
    expect(resolveOfflineEditingAllowedForShare("read", true)).toBe(false);
  });

  it("buildSharePatch clears offline when downgrading to read", () => {
    expect(
      buildSharePatch({ share_id: "share-1", permission: "read" }),
    ).toEqual({ permission: "read", offline_editing_allowed: false });
  });

  it("buildSharePatch enables offline when upgrading to edit", () => {
    expect(
      buildSharePatch({ share_id: "share-1", permission: "edit" }),
    ).toEqual({ permission: "edit", offline_editing_allowed: true });
  });

  it("requires at least one field on share update", () => {
    expect(updateShareSchema.safeParse({ share_id: "share-1" }).success).toBe(false);
  });
});
