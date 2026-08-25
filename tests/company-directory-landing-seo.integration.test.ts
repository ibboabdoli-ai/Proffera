import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSql: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { listDirectorySeoLandings } from "@/lib/company-directory-landing-seo";

const RUN_POSTGRES_INTEGRATION = process.env.GITHUB_ACTIONS === "true" || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function postgresSql(client: Client) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) query += `$${index + 1}${strings[index + 1] ?? ""}`;
    return (await client.query(query, values)).rows;
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)("Directory SEO landing location safety", () => {
  let containerName = "";
  let connectionString = "";
  let client: Client | null = null;

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
    containerName = `proffera-directory-landing-${process.pid}-${Date.now()}`;
    docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres", "-e", "POSTGRES_DB=proffera_test", "-p", "127.0.0.1::5432", "postgres:16-alpine"]);
    const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
    const port = portLine.match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);
    connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
    await waitForPostgres();
    client = new Client({ connectionString });
    await client.connect();
    await client.query(`
      create table company_directory_profiles (
        id uuid primary key,
        claimed_workspace_id uuid,
        city text not null default '',
        municipality text not null default '',
        publication_status text not null,
        is_active boolean not null default true,
        privacy_blocked boolean not null default false
      );
      create table company_directory_services (
        slug text primary key,
        label text not null,
        is_active boolean not null default true
      );
      create table company_directory_profile_services (
        profile_id uuid not null,
        service_slug text not null,
        is_active boolean not null default true,
        public_visible boolean not null default true
      );
      create table company_directory_scb_enrichment (
        profile_id uuid primary key,
        workplaces jsonb not null default '[]'::jsonb,
        conflicts jsonb not null default '[]'::jsonb
      );
    `);
  }, 120_000);

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    if (containerName) {
      try { docker(["stop", containerName]); } catch { /* container may already be gone */ }
    }
  }, 30_000);

  beforeEach(async () => {
    mocks.getSql.mockReset();
    mocks.getSql.mockReturnValue(postgresSql(client!));
    await client!.query("truncate company_directory_scb_enrichment, company_directory_profile_services, company_directory_services, company_directory_profiles");
    await client!.query("insert into company_directory_services (slug, label) values ('vvs', 'VVS / Rörmokare')");
  });

  async function insertProfile(index: number, workplaces: unknown[], claimed = false) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const workspaceId = claimed ? `10000000-0000-4000-8000-${String(index).padStart(12, "0")}` : null;
    await client!.query(
      "insert into company_directory_profiles (id, claimed_workspace_id, city, municipality, publication_status) values ($1, $2, 'Stockholm', 'Stockholm', 'published')",
      [id, workspaceId],
    );
    await client!.query("insert into company_directory_profile_services (profile_id, service_slug) values ($1, 'vvs')", [id]);
    await client!.query("insert into company_directory_scb_enrichment (profile_id, workplaces) values ($1, $2::jsonb)", [id, JSON.stringify(workplaces)]);
  }

  const completeWorkplace = [{ municipality: "Södertälje", visitingAddress: { addressLine: "Nya vägen 2", postalCode: "151 00", city: "Södertälje" } }];

  it("creates an unclaimed landing only from one complete conflict-free SCB workplace", async () => {
    await insertProfile(1, completeWorkplace);
    await insertProfile(2, completeWorkplace);
    await insertProfile(3, completeWorkplace);
    expect(await listDirectorySeoLandings()).toEqual([
      expect.objectContaining({ serviceSlug: "vvs", location: "Södertälje", locationSlug: "sodertalje", businessCount: 3 }),
    ]);
  });

  it.each([
    ["missing", []],
    ["multiple", [...completeWorkplace, ...completeWorkplace]],
    ["incomplete", [{ municipality: "Södertälje", visitingAddress: { addressLine: "Nya vägen 2", postalCode: "", city: "Södertälje" } }]],
  ])("fails closed when one unclaimed profile has a %s SCB workplace", async (_name, unsafeWorkplaces) => {
    await insertProfile(1, completeWorkplace);
    await insertProfile(2, completeWorkplace);
    await insertProfile(3, unsafeWorkplaces as unknown[]);
    expect(await listDirectorySeoLandings()).toEqual([]);
  });

  it("allows claimed profiles to use their owner-controlled profile location", async () => {
    await insertProfile(1, [], true);
    await insertProfile(2, [], true);
    await insertProfile(3, [], true);
    expect(await listDirectorySeoLandings()).toEqual([
      expect.objectContaining({ serviceSlug: "vvs", location: "Stockholm", locationSlug: "stockholm", businessCount: 3 }),
    ]);
  });
});
