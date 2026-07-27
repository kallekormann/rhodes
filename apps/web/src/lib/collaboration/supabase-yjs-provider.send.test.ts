import type { RealtimeChannel } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { SupabaseYjsProvider } from "./supabase-yjs-provider";

type SubscribeCallback = (status: string) => void;

function installBrowserGlobals() {
  vi.stubGlobal("window", {
    setInterval: () => 1,
    clearInterval: vi.fn(),
    setTimeout: (fn: () => void) => {
      fn();
      return 1;
    },
    clearTimeout: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe("SupabaseYjsProvider send transport", () => {
  let subscribeCallback: SubscribeCallback | null = null;
  let mockChannel: RealtimeChannel;
  const send = vi.fn().mockResolvedValue("ok");
  const httpSend = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    subscribeCallback = null;
    send.mockClear();
    httpSend.mockClear();
    installBrowserGlobals();

    mockChannel = {
      on: vi.fn(),
      subscribe: vi.fn((callback: SubscribeCallback) => {
        subscribeCallback = callback;
      }),
      send,
      httpSend,
      state: "joined",
      socket: { isConnected: () => true },
    } as unknown as RealtimeChannel;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createProvider() {
    const doc = new Y.Doc();
    const provider = new SupabaseYjsProvider({
      documentId: "doc-1",
      doc,
      supabase: {
        channel: vi.fn(() => mockChannel),
        removeChannel: vi.fn().mockResolvedValue(undefined),
      },
      reauth: async () => {},
    });
    return { provider, doc };
  }

  it("tracks channelJoined across subscribe lifecycle", () => {
    const { provider } = createProvider();
    expect(provider.isChannelJoined).toBe(false);
    subscribeCallback!("SUBSCRIBED");
    expect(provider.isChannelJoined).toBe(true);
    subscribeCallback!("CLOSED");
    expect(provider.isChannelJoined).toBe(false);
    provider.destroy();
  });

  it("uses channel.send when push-capable", async () => {
    const { provider, doc } = createProvider();
    subscribeCallback!("SUBSCRIBED");
    doc.getMap("test").set("x", 1);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    expect(httpSend).not.toHaveBeenCalled();
    provider.destroy();
  });

  it("uses httpSend when websocket push is unavailable", async () => {
    mockChannel = {
      ...mockChannel,
      state: "joining",
      socket: { isConnected: () => false },
    } as unknown as RealtimeChannel;

    const { provider, doc } = createProvider();
    subscribeCallback!("SUBSCRIBED");
    doc.getMap("test").set("x", 1);
    await vi.waitFor(() => expect(httpSend).toHaveBeenCalled());
    expect(send).not.toHaveBeenCalled();
    provider.destroy();
  });

  it("uses httpSend before subscribe completes", async () => {
    const { provider, doc } = createProvider();
    doc.getMap("test").set("x", 1);
    await vi.waitFor(() => expect(httpSend).toHaveBeenCalled());
    expect(send).not.toHaveBeenCalled();
    provider.destroy();
  });
});
