import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  getBlockContributors,
  pruneBlockAudit,
  recordBlockAudit,
} from "@/lib/collaboration/block-audit";

describe("block-audit", () => {
  it("records and reads back a single contributor for a block", () => {
    const doc = new Y.Doc();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", 1_000);

    const contributors = getBlockContributors(doc, "b1", 0);
    expect(contributors).toEqual([
      { userId: "user-b", displayName: "User B", editedAt: 1_000 },
    ]);

    doc.destroy();
  });

  it("keeps independent entries per (blockId, userId) — no read-modify-write races", () => {
    const doc = new Y.Doc();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", 1_000);
    recordBlockAudit(doc, ["b1"], "user-c", "User C", 2_000);

    const contributors = getBlockContributors(doc, "b1", 0);
    expect(contributors.map((c) => c.userId).sort()).toEqual([
      "user-b",
      "user-c",
    ]);
  });

  it("does not mix up contributors from different blocks", () => {
    const doc = new Y.Doc();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", 1_000);
    recordBlockAudit(doc, ["b2"], "user-c", "User C", 1_000);

    expect(getBlockContributors(doc, "b1", 0)).toEqual([
      { userId: "user-b", displayName: "User B", editedAt: 1_000 },
    ]);
    expect(getBlockContributors(doc, "b2", 0)).toEqual([
      { userId: "user-c", displayName: "User C", editedAt: 1_000 },
    ]);
  });

  it("filters out entries older than the requested window", () => {
    const doc = new Y.Doc();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", 1_000);

    expect(getBlockContributors(doc, "b1", 5_000)).toEqual([]);
    expect(getBlockContributors(doc, "b1", 1_000)).toHaveLength(1);
  });

  it("excludes the given userId (e.g. the local reviewer)", () => {
    const doc = new Y.Doc();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", 1_000);
    recordBlockAudit(doc, ["b1"], "local-user", "You", 1_000);

    const contributors = getBlockContributors(doc, "b1", 0, "local-user");
    expect(contributors.map((c) => c.userId)).toEqual(["user-b"]);
  });

  it("replicates through normal Yjs sync like any other document content", () => {
    const doc = new Y.Doc();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", 1_000);

    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(doc));

    expect(getBlockContributors(replica, "b1", 0)).toEqual([
      { userId: "user-b", displayName: "User B", editedAt: 1_000 },
    ]);

    doc.destroy();
    replica.destroy();
  });

  it("overwrites a user's own entry for the same block on a later edit (last write wins)", () => {
    const doc = new Y.Doc();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", 1_000);
    recordBlockAudit(doc, ["b1"], "user-b", "User B", 2_000);

    const contributors = getBlockContributors(doc, "b1", 0);
    expect(contributors).toEqual([
      { userId: "user-b", displayName: "User B", editedAt: 2_000 },
    ]);
  });

  it("prunes entries older than the cutoff and leaves fresher ones intact", () => {
    const doc = new Y.Doc();
    const now = Date.now();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", now - 1_000_000);
    recordBlockAudit(doc, ["b1"], "user-c", "User C", now);

    pruneBlockAudit(doc, 500_000);

    const contributors = getBlockContributors(doc, "b1", 0);
    expect(contributors.map((c) => c.userId)).toEqual(["user-c"]);
  });

  it("is a no-op when there is nothing stale to prune", () => {
    const doc = new Y.Doc();
    recordBlockAudit(doc, ["b1"], "user-b", "User B", Date.now());

    expect(() => pruneBlockAudit(doc, 24 * 60 * 60 * 1000)).not.toThrow();
    expect(getBlockContributors(doc, "b1", 0)).toHaveLength(1);
  });

  it("ignores empty blockIds arrays", () => {
    const doc = new Y.Doc();
    expect(() => recordBlockAudit(doc, [], "user-b", "User B")).not.toThrow();
    expect(getBlockContributors(doc, "b1", 0)).toEqual([]);
  });
});
