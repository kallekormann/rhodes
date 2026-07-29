import { describe, expect, it } from "vitest";
import {
  hasFreshRemotePeers,
  parseSessionPresencePayload,
} from "@/lib/collaboration/document-session-presence";

describe("document-session-presence", () => {
  it("ignores self and invalid payloads", () => {
    expect(
      parseSessionPresencePayload(
        { user_id: "me", display_name: "Me", last_seen: 1 },
        "me",
      ),
    ).toBeNull();
    expect(parseSessionPresencePayload(null, "me")).toBeNull();
    expect(parseSessionPresencePayload({ user_id: "" }, "me")).toBeNull();
  });

  it("parses remote peer payloads", () => {
    expect(
      parseSessionPresencePayload(
        { user_id: "peer-1", display_name: "Peer", last_seen: 42 },
        "me",
      ),
    ).toEqual({
      user_id: "peer-1",
      display_name: "Peer",
      last_seen: 42,
    });
  });

  it("detects fresh remote peers", () => {
    const peers = new Map<string, number>([["peer-1", Date.now() - 1_000]]);
    expect(hasFreshRemotePeers(peers)).toBe(true);
    expect(
      hasFreshRemotePeers(
        new Map([["peer-1", Date.now() - 10_000]]),
        Date.now(),
      ),
    ).toBe(false);
  });
});
