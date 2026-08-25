import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  hasWorkspaceFeatureAccessForWorkspace: vi.fn(async () => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspaceFeatureAccessForWorkspace: mocks.hasWorkspaceFeatureAccessForWorkspace,
}));

import { listPublicBusinessSitemapEntries } from "@/lib/public-business-seo";

type PendingQuery = {
  text: string;
  values: unknown[];
};

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function taggedQuery(strings: TemplateStringsArray, values: unknown[]): PendingQuery {
  let text = "";
  for (let index = 0; index < strings.length; index += 1) {
    text += strings[index] ?? "";
    if (index < values.length) text += `$${index + 1}`;
  }
  return { text, values };
}

function createPostgresSqlAdapter(client: Client) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = taggedQuery(strings, values);
    const result = await client.query(query.text, query.values);
    return result.rows as Record<string, unknown>[];
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Public Business sitemap effective-name PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client;

    async function waitForPostgres() {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const probe = new Client({ connectionString });
        try {
          await probe.connect();
          await probe.query("select 1");
          await probe.end();
          return;
        } catch (error) {
          lastError = error;
          await probe.end().catch(() => undefined);
          await delay(500);
        }
      }
      throw lastError ?? new Error("PostgreSQL test container did not become ready");
    }

    beforeAll(async () => {
      containerName = `proffera-public-business-seo-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_test",
        "-p", "127.0.0.1::5432",
        "postgres:16-alpine",
      ]);

      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
      const port = portLine.match(/:(\d+)$/u)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);

      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString });
      await client.connect();

      await client.query(`
        create table workspaces (
          id uuid primary key,
          slug text,
          status text not null,
          company_name text,
          name text
        );
        create table workspace_settings (
          workspace_id text primary key,
          company_name text
        );
        create table workspace_services (
          id uuid primary key,
          workspace_id text not null,
          public_slug text,
          is_active boolean not null default true,
          public_status text not null default 'published',
          sort_order integer not null default 0,
          name text not null default ''
        );
      `);

      await client.query(`
        insert into workspaces (id, slug, status, company_name, name) values
          ('11111111-1111-4111-8111-111111111111', 'settings-fallback', 'active', 'Proffera Test Workspace', 'Proffera Test Workspace'),
          ('22222222-2222-4222-8222-222222222222', 'company-fallback', 'active', 'Real Company AB', 'Proffera Test Workspace'),
          ('33333333-3333-4333-8333-333333333333', 'name-fallback', 'active', '   ', 'Real Name AB'),
          ('44444444-4444-4444-8444-444444444444', 'test-fallback', 'active', '   ', 'Proffera Test Demo');

        insert into workspace_settings (workspace_id, company_name) values
          ('11111111-1111-4111-8111-111111111111', 'Owner Renamed AB'),
          ('22222222-2222-4222-8222-222222222222', '   '),
          ('33333333-3333-4333-8333-333333333333', '   '),
          ('44444444-4444-4444-8444-444444444444', '   ');
      `);

      mocks.getSql.mockReturnValue(createPostgresSqlAdapter(client));
    }, 60_000);

    afterAll(async () => {
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // Container may already have stopped after a failing test.
        }
      }
    });

    it("trims every effective-name candidate before falling back and filtering test workspaces", async () => {
      await expect(listPublicBusinessSitemapEntries()).resolves.toEqual([
        {
          workspaceId: "22222222-2222-4222-8222-222222222222",
          workspaceSlug: "company-fallback",
          serviceSlug: null,
        },
        {
          workspaceId: "33333333-3333-4333-8333-333333333333",
          workspaceSlug: "name-fallback",
          serviceSlug: null,
        },
        {
          workspaceId: "11111111-1111-4111-8111-111111111111",
          workspaceSlug: "settings-fallback",
          serviceSlug: null,
        },
      ]);

      expect(mocks.hasWorkspaceFeatureAccessForWorkspace).toHaveBeenCalledTimes(3);
    });
  },
);
