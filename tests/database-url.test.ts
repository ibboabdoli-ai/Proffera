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

  it("fails closed in Preview when the dedicated Preview database is missing", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        DATABASE_URL: "postgres://production",
        POSTGRES_URL: "postgres://shared",
      }),
    ).toBeNull();
  });

  it("fails closed when Preview resolves to the same database target as a shared URL", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        PROFFERA_PREVIEW_DATABASE_URL:
          "postgresql://preview_user:preview_password@ep-production-pooler.example.neon.tech/neondb?sslmode=require",
        DATABASE_URL:
          "postgresql://production_user:production_password@ep-production.example.neon.tech/neondb?channel_binding=require&sslmode=require",
      }),
    ).toBeNull();
  });

  it.each(["postgres", "postgresql"])(
    "fails closed when a %s Preview URL omits PostgreSQL's default port but the shared URL uses :5432",
    (scheme) => {
      expect(
        resolveDatabaseUrl({
          ...testEnvironment,
          VERCEL_ENV: "preview",
          PROFFERA_PREVIEW_DATABASE_URL:
            `${scheme}://preview_user:preview_password@ep-shared.example.neon.tech/neondb?sslmode=require`,
          DATABASE_URL:
            `${scheme}://production_user:production_password@ep-shared.example.neon.tech:5432/neondb?sslmode=require`,
        }),
      ).toBeNull();
    },
  );

  it("fails closed when Preview overlaps a shared Vercel Postgres fallback", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        PROFFERA_PREVIEW_DATABASE_URL:
          "postgresql://preview_user:preview_password@ep-shared-pooler.example.neon.tech/neondb?sslmode=require",
        POSTGRES_URL:
          "postgresql://shared_user:shared_password@ep-shared.example.neon.tech/neondb?sslmode=require",
      }),
    ).toBeNull();
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
        POSTGRES_URL: "postgres://shared",
      }),
    ).toBe("postgres://production");
  });

  it("uses the configured Vercel Postgres fallback when DATABASE_URL is absent outside Preview", () => {
    expect(
      resolveDatabaseUrl({
        ...testEnvironment,
        POSTGRES_URL: "postgres://shared",
      }),
    ).toBe("postgres://shared");
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
