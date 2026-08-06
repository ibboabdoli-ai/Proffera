import { describe, expect, it } from "vitest";

import { resolveDatabaseUrl } from "../src/lib/db/database-url";

describe("database URL resolution", () => {
  it("keeps DATABASE_URL as the first choice", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgres://production",
        POSTGRES_URL: "postgres://preview",
      }),
    ).toBe("postgres://production");
  });

  it("uses the configured Vercel Postgres fallback when DATABASE_URL is absent", () => {
    expect(
      resolveDatabaseUrl({
        POSTGRES_URL: "postgres://preview",
      }),
    ).toBe("postgres://preview");
  });

  it("skips empty values and supports unpooled Neon URLs", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "   ",
        DATABASE_URL_UNPOOLED: "postgres://unpooled",
      }),
    ).toBe("postgres://unpooled");
  });

  it("returns null when no supported database URL exists", () => {
    expect(resolveDatabaseUrl({})).toBeNull();
  });
});
