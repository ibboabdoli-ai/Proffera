import { describe, expect, it } from "vitest";

import { postgresTimestampIso } from "./postgres-timestamp";

describe("PostgreSQL booking timestamp precision", () => {
  it("preserves nonzero milliseconds when a driver returns Date", () => {
    const stored = new Date("2026-11-08T15:59:18.123Z");
    expect(new Date(String(stored)).toISOString()).toBe("2026-11-08T15:59:18.000Z");
    expect(postgresTimestampIso(stored)).toBe("2026-11-08T15:59:18.123Z");
  });

  it("accepts ISO text and rejects invalid timestamps", () => {
    expect(postgresTimestampIso("2026-11-08T15:59:18.456Z"))
      .toBe("2026-11-08T15:59:18.456Z");
    expect(() => postgresTimestampIso("not a timestamp"))
      .toThrow("Invalid PostgreSQL booking timestamp");
  });
