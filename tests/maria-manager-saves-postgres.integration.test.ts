import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

type Query = { text: string; values: unknown[] };
type QueryResponse = Record<string, unknown>[];
const runtime = vi.hoisted(() => ({
  makeSql: undefined as undefined | (() => unknown),
  workspaceId: "",
  userId: "maria-qa-manager",
  role: "owner",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({
  getSql: () => runtime.makeSql?.() ?? null,
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, workspaceId: runtime.workspaceId, workspaceSlug: "makeup-by-maria",
    userId: runtime.userId, role: runtime.role,
  }),
  canManageWorkspaceSettings: (access: { ok: boolean; role: string }) =>
    access.ok && (access.role === "owner" || access.role === "admin"),
}));
vi.mock("@/lib/workspace-module-access", () => ({
  hasDashboardModuleAccess: async (moduleId: string) => moduleId === "online_booking",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error("TEST_REDIRECT:" + url); },
}));

import { readMariaManualSwishStatuses, setMariaManualSwishStatus } from "@/lib/maria-manual-swish";
import { saveMariaYearAction } from "@/app/dashboard/maria/actions";

const RUN = process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function compileSql(strings: TemplateStringsArray, values: unknown[]): Query {
  let text = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    text += "$" + (i + 1) + (strings[i + 1] ?? "");
  }
  return { text, values };
}

(RUN ? describe.sequential : describe.skip)("Maria manager saves against real PostgreSQL", () => {
  let container = "";
  let connectionString = "";
  let db: Client | undefined;
  const workspaceId = randomUUID();
  const customerId = randomUUID();
  const bookingId = randomUUID();

  beforeAll(async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    runtime.workspaceId = workspaceId;
    container = "proffera-maria-manager-" + process.pid + "-" + Date.now();
    docker(["run", "--rm", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
      "-e", "POSTGRES_DB=proffera_test", "-p", "127.0.0.1::5432",
      "postgis/postgis:16-3.5-alpine"]);
    const port = docker(["port", container, "5432/tcp"]).split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error("Maria PostgreSQL test port missing");
    connectionString = "postgres://postgres:postgres@127.0.0.1:" + port + "/proffera_test";
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const probe = new Client({ connectionString });
      try {
        await probe.connect();
        await probe.query("select 1");
        await probe.end();
        ready = true;
        break;
      } catch {
        await probe.end().catch(() => undefined);
        await delay(500);
      }
    }
    if (!ready) throw new Error("Maria PostgreSQL test database unavailable");
    db = new Client({ connectionString });
    await db.connect();
    await applyCanonicalProfferaMigrations(db);

    runtime.makeSql = () => Object.assign(
      (parts: TemplateStringsArray, ...values: unknown[]) => {
        const query = compileSql(parts, values);
        return Object.assign(query, {
          then: (
            resolve: (rows: QueryResponse) => unknown,
            reject: (error: unknown) => unknown,
          ) => db!.query(query.text, query.values)
            .then((result) => resolve(result.rows as QueryResponse), reject),
        });
      },
      {
        transaction: async (queries: Query[]) => {
          const tx = new Client({ connectionString });
          await tx.connect();
          try {
            await tx.query("BEGIN");
            const results: QueryResponse[] = [];
            for (const query of queries) {
              const result = await tx.query(query.text, query.values);
              results.push(result.rows as QueryResponse);
            }
            await tx.query("COMMIT");
            return results;
          } catch (error) {
            await tx.query("ROLLBACK").catch(() => undefined);
            throw error;
          } finally {
            await tx.end();
          }
        },
      },
    );

    await db.query(
      "insert into workspaces (id, slug, public_booking_slug, name, status) values ($1::uuid, 'makeup-by-maria', 'makeup-by-maria', 'Maria QA', 'active')",
      [workspaceId],
    );
    await db.query(
      "insert into customers (id, workspace_id, name, status, source) values ($1::uuid, $2, 'Synthetic Maria customer', 'active', 'dashboard_manual')",
      [customerId, workspaceId],
    );
    await db.query(
      "insert into bookings (id, workspace_id, customer_id, title, service, status, source, starts_at, ends_at) values ($1::uuid, $2, $3::uuid, 'Synthetic bridal service', 'Brudsmink med prov 2026', 'confirmed', 'dashboard_manual', now()+interval '20 days', now()+interval '20 days 3 hours')",
      [bookingId, workspaceId, customerId],
    );
  }, 180_000);

  afterAll(async () => {
    runtime.makeSql = undefined;
    vi.unstubAllEnvs();
    await db?.end().catch(() => undefined);
    if (container) {
      try { docker(["stop", container]); } catch { /* --rm already stopped */ }
    }
  }, 30_000);

  it("records, reads, deduplicates and reverses the human-verified Swish deposit", async () => {
    expect((await readMariaManualSwishStatuses()).entries[bookingId]?.state).toBe("unverified");
    expect(await setMariaManualSwishStatus(bookingId, "paid")).toEqual({ changed: true });
    expect((await readMariaManualSwishStatuses()).entries[bookingId]?.state).toBe("paid");
    expect(await setMariaManualSwishStatus(bookingId, "paid")).toEqual({ changed: false });
    const paid = await db!.query<{ metadata: { state: string; amount_minor: number; booking_number: string; actor_user_id: string } }>(
      "select metadata from customer_events where workspace_id=$1 and booking_id=$2::uuid and metadata->>'source'='maria_swish_manual_deposit_v1'",
      [workspaceId, bookingId],
    );
    expect(paid.rowCount).toBe(1);
    expect(paid.rows[0]?.metadata).toMatchObject({
      state: "paid", amount_minor: 200000,
      booking_number: "MBM-" + bookingId.replaceAll("-", "").toUpperCase(),
      actor_user_id: runtime.userId,
    });
    expect(await setMariaManualSwishStatus(bookingId, "unverified")).toEqual({ changed: true });
    expect((await readMariaManualSwishStatuses()).entries[bookingId]?.state).toBe("unverified");
    const after = await db!.query(
      "select metadata->>'state' as state from customer_events where workspace_id=$1 and booking_id=$2::uuid and metadata->>'source'='maria_swish_manual_deposit_v1' order by created_at, id",
      [workspaceId, bookingId],
    );
    expect(after.rowCount).toBe(2);
    expect(after.rows.map((row) => row.state).sort()).toEqual(["paid", "unverified"]);
  });

  it("rejects an unknown booking without writing any payment event", async () => {
    const count = () => db!.query<{ count: number }>(
      "select count(*)::int as count from customer_events where workspace_id=$1 and metadata->>'source'='maria_swish_manual_deposit_v1'",
      [workspaceId],
    );
    const before = Number((await count()).rows[0]?.count);
    await expect(setMariaManualSwishStatus(randomUUID(), "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_INELIGIBLE");
    expect(Number((await count()).rows[0]?.count)).toBe(before);
  });

  it("saves exact öre in price_amount_minor and only whole SEK in the legacy integer column", async () => {
    const form = new FormData();
    form.set("year", "2026");
    form.set("enabled", "on");
    form.set("trial", "6900.50");
    form.set("without", "5800");
    form.set("trial_description", "Brudmakeup med provsminkning");
    form.set("without_description", "Brudmakeup utan prov");
    await expect(saveMariaYearAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2026&year=2026#priser");

    const rows = await db!.query<{
      public_slug: string; price_type: string; price_amount_minor: string | number;
      base_price_sek: number | null; short_description: string; public_status: string;
    }>(
      "select public_slug,price_type,price_amount_minor,base_price_sek,short_description,public_status from workspace_services where workspace_id=$1 and public_slug in ('maria-bridal-trial-2026','maria-bridal-without-trial-2026') order by public_slug",
      [workspaceId],
    );
    expect(rows.rowCount).toBe(2);
    const trial = rows.rows.find((row) => row.public_slug === "maria-bridal-trial-2026");
    const without = rows.rows.find((row) => row.public_slug === "maria-bridal-without-trial-2026");
    expect(Number(trial?.price_amount_minor)).toBe(690050);
    expect(trial?.base_price_sek).toBeNull();
    expect(trial?.short_description).toBe("Brudmakeup med provsminkning");
    expect(without?.price_type).toBe("fixed");
    expect(Number(without?.price_amount_minor)).toBe(580000);
    expect(without?.base_price_sek).toBe(5800);
    expect(trial?.public_status).toBe("draft");

    await db!.query(
      "update workspace_services set public_status='published' where workspace_id=$1 and public_slug='maria-bridal-trial-2026'",
      [workspaceId],
    );
    form.set("trial", "6900.75");
    await expect(saveMariaYearAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2026&year=2026#priser");
    const updated = await db!.query(
      "select price_amount_minor,base_price_sek,public_status from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2026'",
      [workspaceId],
    );
    expect(Number(updated.rows[0]?.price_amount_minor)).toBe(690075);
    expect(updated.rows[0]?.base_price_sek).toBeNull();
    expect(updated.rows[0]?.public_status).toBe("published");
  });
});
