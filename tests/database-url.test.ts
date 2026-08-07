import { describe, expect, it } from "vitest";

import { resolveDatabaseUrl } from "../src/lib/db/database-url";

const testEnvironment = {
  NODE_ENV: "test",
} satisfies NodeJS.ProcessEnv;

describe("database URL resolution", () => {
  it("uses the dedicated Preview database before every shared database variable", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        PROFFERA_PREVIEW_DATABASE_URL: "postgres://isolated-preview",
        DATABASE_URL: "postgres://production",
        POSTGRES_URL: "postgres://shared",
      }),
    ).toBe("postgres://isolated-preview");
  });

  it("ignores the Preview database variable outside Vercel Preview", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        VERCEL_ENV: "production",
        PROFFERA_PREVIEW_DATABASE_URL: "postgres://isolated-preview",
        DATABASE_URL: "postgres://production",
      }),
    ).toBe("postgres://production");
  });

  it("keeps DATABASE_URL as the first shared choice", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        DATABASE_URL: "postgres://production",
        POSTGRES_URL: "postgres://preview",
      }),
    ).toBe("postgres://production");
  });

  it("uses the configured Vercel Postgres fallback when DATABASE_URL is absent", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        POSTGRES_URL: "postgres://preview",
      }),
    ).toBe("postgres://preview");
  });

  it("skips empty values and supports unpooled Neon URLs", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        DATABASE_URL: "   ",
        DATABASE_URL_UNPOOLED: "postgres://unpooled",
      }),
    ).toBe("postgres://unpooled");
  });

  it("returns null when no supported database URL exists", () => {
    expect(resolveDatabaseUrl(testEnvironment)).toBeNull();
  });
});
