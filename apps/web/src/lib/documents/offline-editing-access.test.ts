import { describe, expect, it } from "vitest";
import { canUserOfflineEditDocument } from "@/lib/documents/offline-editing-access";

describe("canUserOfflineEditDocument", () => {
  it("allows owners without a share grant", () => {
    expect(
      canUserOfflineEditDocument({
        userId: "owner",
        createdBy: "owner",
      }),
    ).toBe(true);
  });

  it("allows edit shares with offline enabled", () => {
    expect(
      canUserOfflineEditDocument({
        userId: "collab",
        createdBy: "owner",
        incomingShare: {
          permission: "edit",
          offline_editing_allowed: true,
        },
      }),
    ).toBe(true);
  });

  it("denies edit shares when owner opted out of offline", () => {
    expect(
      canUserOfflineEditDocument({
        userId: "collab",
        createdBy: "owner",
        incomingShare: {
          permission: "edit",
          offline_editing_allowed: false,
        },
      }),
    ).toBe(false);
  });

  it("denies read shares", () => {
    expect(
      canUserOfflineEditDocument({
        userId: "viewer",
        createdBy: "owner",
        incomingShare: {
          permission: "read",
          offline_editing_allowed: false,
        },
      }),
    ).toBe(false);
  });
});
