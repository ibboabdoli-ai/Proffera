import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { sessionKey } from "@/components/public-business/public-business-tracking";

describe("public-business session key", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("window", {
      crypto: {
        randomUUID: undefined,
        getRandomValues: (bytes: Uint8Array) => { bytes.fill(171); return bytes; },
      },
      sessionStorage: {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => { items.set(key, value); },
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to secure random bytes instead of Math.random", () => {
    expect(sessionKey()).toBe("ab".repeat(16));
    expect(sessionKey()).toBe("ab".repeat(16));
  });

  it("returns empty when secure random generation is unavailable", () => {
    Object.assign(window, { crypto: {} });
    expect(sessionKey()).toBe("");
  });
});
