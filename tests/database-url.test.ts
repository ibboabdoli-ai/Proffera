import { Client } from "pg";
import { describe, expect, it } from "vitest";

import {
  normalizeNodePostgresSslMode,
  resolveDatabaseUrl,
  resolveNodePostgresDatabaseUrl,
} from "../src/lib/db/database-url";

const testEnvironment = {
  NODE_ENV: "test",
} satisfies NodeJS.ProcessEnv;

type ClientWithConnectionParameters = Client & {
  connectionParameters: {
    ssl: boolean | { rejectUnauthorized?: boolean };
  };
};

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

  it.each(["pg", "postgres", "postgresql"])(
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

describe("node-postgres SSL compatibility", () => {
  it.each(["prefer", "require", "verify-ca"])(
    "strengthens sslmode=%s to explicit verify-full while preserving connection options",
    (sslMode) => {
      const normalized = normalizeNodePostgresSslMode(
        `postgresql://user:secret@ep-example-pooler.example.neon.tech/neondb?channel_binding=require&sslmode=${sslMode}`,
      );
      const parsed = new URL(normalized);

      expect(parsed.searchParams.get("sslmode")).toBe("verify-full");
      expect(parsed.searchParams.get("channel_binding")).toBe("require");
      expect(parsed.hostname).toBe("ep-example-pooler.example.neon.tech");
      expect(parsed.pathname).toBe("/neondb");
    },
  );

  it("strengthens pg: compatibility URLs through node-postgres parsing", () => {
    const normalized = normalizeNodePostgresSslMode(
      "pg://user:secret@ep-example.example.neon.tech/neondb?uselibpqcompat=true&sslmode=require",
    );
    const parsed = new URL(normalized);
    const client = new Client({ connectionString: normalized }) as ClientWithConnectionParameters;
    const ssl = client.connectionParameters.ssl;

    expect(parsed.protocol).toBe("pg:");
    expect(parsed.searchParams.get("uselibpqcompat")).toBe("true");
    expect(parsed.searchParams.get("sslmode")).toBe("verify-full");
    expect(ssl).not.toBe(false);
    if (ssl && typeof ssl === "object") {
      expect(ssl.rejectUnauthorized).not.toBe(false);
    }
  });

  it.each(["verify-full", "disable"])(
    "leaves explicit sslmode=%s unchanged",
    (sslMode) => {
      const value = `postgresql://user:secret@ep-example.example.neon.tech/neondb?sslmode=${sslMode}`;
      expect(normalizeNodePostgresSslMode(value)).toBe(value);
    },
  );

  it("leaves URLs without an sslmode unchanged", () => {
    const value = "postgresql://user:secret@localhost:5432/neondb";
    expect(normalizeNodePostgresSslMode(value)).toBe(value);
  });

  it("keeps Preview isolation before strengthening the dedicated pg connection", () => {
    const resolved = resolveNodePostgresDatabaseUrl({
      ...testEnvironment,
      VERCEL_ENV: "preview",
      PROFFERA_PREVIEW_DATABASE_URL:
        "postgresql://preview_user:preview_password@ep-preview.example.neon.tech/neondb?channel_binding=require&sslmode=require",
      DATABASE_URL:
        "postgresql://production_user:production_password@ep-production.example.neon.tech/neondb?sslmode=require",
    });

    expect(resolved).not.toBeNull();
    const parsed = new URL(resolved!);
    expect(parsed.hostname).toBe("ep-preview.example.neon.tech");
    expect(parsed.searchParams.get("sslmode")).toBe("verify-full");
    expect(parsed.searchParams.get("channel_binding")).toBe("require");
  });

  it("still fails closed when the dedicated Preview database overlaps Production", () => {
    expect(
      resolveNodePostgresDatabaseUrl({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        PROFFERA_PREVIEW_DATABASE_URL:
          "postgresql://preview_user:preview_password@ep-production-pooler.example.neon.tech/neondb?sslmode=require",
        DATABASE_URL:
          "postgresql://production_user:production_password@ep-production.example.neon.tech/neondb?sslmode=require",
      }),
    ).toBeNull();
  });
});
