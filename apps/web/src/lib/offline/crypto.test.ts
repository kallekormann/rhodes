import { describe, expect, it } from "vitest";
import {
  bytesToBase64,
  base64ToBytes,
  decryptJson,
  encryptJson,
  generateAesGcmKey,
  importAesGcmKey,
  exportAesGcmKey,
} from "./crypto";

describe("offline crypto", () => {
  it("round-trips base64", () => {
    const input = new Uint8Array([0, 1, 255, 42]);
    expect(base64ToBytes(bytesToBase64(input))).toEqual(input);
  });

  it("round-trips JSON with a fresh AES-GCM key", async () => {
    const key = await generateAesGcmKey();
    const payload = { messages: [{ role: "user", text: "hello" }], n: 3 };
    const blob = await encryptJson(key, payload);
    expect(await decryptJson<typeof payload>(key, blob)).toEqual(payload);
  });

  it("round-trips JSON after JWK export/import", async () => {
    const key = await generateAesGcmKey();
    const restored = await importAesGcmKey(await exportAesGcmKey(key));
    const blob = await encryptJson(restored, { ok: true });
    expect(await decryptJson<{ ok: boolean }>(restored, blob)).toEqual({
      ok: true,
    });
  });
});
