import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";
import { mariaCalendarIntervals } from "@/lib/maria-manual-calendar-policy";

type Query = { text: string; values: unknown[] };
type Rows = Record<string, unknown>[];

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  readiness: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/maria-booking-runtime", () => ({
  getMariaBookingReadiness: mocks.readiness,
}));

import { createMariaUnverifiedBookingRequest } from "@/lib/maria-verified-booking";
import { persistReviewInvitation } from "@/lib/verified-review-persistence";

const RUN = process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}
function compileSql(parts: TemplateStringsArray, values: unknown[]): Query {
  let text = parts[0] ?? "";
  for (let i = 0; i < values.length; i++) text += "$" + (i + 1) + (parts[i + 1] ?? "");
  return { text, values };
}
function futureFriday(): string {
  const d = new Date(Date.now() + 14 * 86_400_000);
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

(RUN ? describe.sequential : describe.skip)("Maria temporary no-OTP requests — real isolated PostgreSQL", () => {
  let container = "";
  let connectionString = "";
  let db: Client | undefined;
  const workspaceId = randomUUID();
  let serviceId = "";
  const day = futureFriday();
  const slot = mariaCalendarIntervals(day, "06:00", "10:00")!
    .find(item => item.clock === "07:00")!;
  const startsAt = slot.startsAt;
  const endsAt = new Date(Date.parse(startsAt) + 180 * 60_000).toISOString();

  const request = (customerEmail = "new-bride@example.invalid") => ({
    workspaceId, serviceId,
    customerName: "Synthetic no-OTP bride",
    customerEmail,
    customerPhone: "+46700000000",
    city: "Södertälje",
    startsAt, endsAt,
    bookingNote: "Synthetic no-OTP QA — no real customer",
    bookingLanguage: "sv" as const,
  });

  async function snapshot() {
    const result = await db!.query<{
      bookings: number; customers: number; references: number; events: number;
    }>(`
      select
        (select count(*)::int from bookings where workspace_id=$1) as bookings,
        (select count(*)::int from customers where workspace_id=$1) as customers,
        (select count(*)::int from maria_booking_references ref
          join bookings b on b.id=ref.booking_id where b.workspace_id=$1) as "references",
        (select count(*)::int from customer_events where workspace_id=$1) as events
    `, [workspaceId]);
    return result.rows[0]!;
  }

  beforeAll(async () => {
    container = "proffera-maria-no-otp-" + process.pid + "-" + Date.now();
    docker(["run", "--rm", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
      "-e", "POSTGRES_DB=proffera_test",
      "-p", "127.0.0.1::5432", "postgis/postgis:16-3.5-alpine"]);
    const port = docker(["port", container, "5432/tcp"])
      .split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error("Synthetic PostgreSQL port unavailable");
    connectionString = "postgres://postgres:postgres@127.0.0.1:" + port + "/proffera_test";
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const probe = new Client({ connectionString });
      try {
        await probe.connect();
        await probe.query("select 1");
        await probe.end();
        ready = true; break;
      } catch {
        await probe.end().catch(() => undefined);
        await delay(500);
      }
    }
    if (!ready) throw new Error("Synthetic PostgreSQL failed to start");
    db = new Client({ connectionString });
    await db.connect();
    await applyCanonicalProfferaMigrations(db);
    await db.query(
      "insert into workspaces(id,slug,name,status,public_booking_slug) " +
        "values($1::uuid,'makeup-by-maria','Maria no-OTP isolated QA','active','makeup-by-maria')",
      [workspaceId],
    );
    const service = await db.query<{ id: string }>(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,is_active," +
        "public_status,minimum_notice_minutes,maximum_advance_days) " +
        "values($1,$2,$3,180,true,'published',0,365) returning id::text",
      [workspaceId, "Synthetic bridal makeup",
        "maria-bridal-trial-" + day.slice(0, 4)],
    );
    serviceId = service.rows[0]!.id;
    await db.query(
      "insert into workspace_booking_hours(workspace_id,weekday,opens_at,closes_at,is_closed) " +
        "values($1,5,'06:00','10:00',false)",
      [workspaceId],
    );
    const sql = Object.assign(
      (parts: TemplateStringsArray, ...values: unknown[]) => {
        const query = compileSql(parts, values);
        return Object.assign(query, {
          then: (resolve: (rows: Rows) => unknown, reject: (err: unknown) => unknown) =>
            db!.query(query.text, query.values).then(result => resolve(result.rows as Rows), reject),
        });
      },
      { transaction: async (queries: Query[]) => {
        const client = new Client({ connectionString });
        await client.connect();
        try {
          await client.query("BEGIN");
          const results: Rows[] = [];
          for (const query of queries) {
            results.push((await client.query(query.text, query.values)).rows as Rows);
          }
          await client.query("COMMIT");
          return results;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          await client.end();
        }
      } },
    );
    mocks.getSql.mockReturnValue(sql);
  }, 180_000);

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.readiness.mockResolvedValue({
      enabled: true, workspaceId,
      publicSlug: "makeup-by-maria",
      companyName: "Maria no-OTP isolated QA",
      ownerEmail: "owner@example.invalid",
      ownerPhone: "",
      primaryCity: "Södertälje",
      timeZone: "Europe/Stockholm",
    });
    for (const [key, value] of Object.entries({
      VERCEL_ENV: "production",
      PROFFERA_MARIA_PUBLIC_SITE_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_ORIGIN: "https://makeupbymaria.se",
      PROFFERA_MARIA_TEMPORARY_NO_OTP_ENABLED: "true",
    })) vi.stubEnv(key, value);
    // All mutations are inside the disposable PostgreSQL container.
    await db!.query("delete from customer_events where workspace_id=$1", [workspaceId]);
    await db!.query("delete from maria_booking_references where booking_id in " +
      "(select id from bookings where workspace_id=$1)", [workspaceId]);
    await db!.query("delete from bookings where workspace_id=$1", [workspaceId]);
    await db!.query("delete from public_booking_verifications where workspace_id=$1::uuid", [workspaceId]);
    await db!.query("delete from customers where workspace_id=$1", [workspaceId]);
    await db!.query("delete from maria_manual_closed_starts where workspace_id=$1::uuid", [workspaceId]);
    await db!.query("delete from maria_booking_reference_counters");
  });

  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    mocks.getSql.mockReset();
    await db?.end().catch(() => undefined);
    if (container) {
      try { docker(["stop", container]); } catch { /* already removed */ }
    }
  }, 30_000);

  it("commits an unverified requested booking, submitted contact, reference and audit atomically", async () => {
    const saved = await createMariaUnverifiedBookingRequest(request());
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error("Synthetic request was not saved");
    expect(await snapshot()).toEqual({ bookings: 1, customers: 1, references: 1, events: 1 });
    const details = await db!.query<{
      status: string; name: string; phone: string; reference: string; verified: boolean;
    }>(`
      select b.status, c.name, c.phone, ref.reference,
        (e.metadata->>'email_verified')::boolean as verified
      from bookings b
      join customers c on c.id=b.customer_id
      join maria_booking_references ref on ref.booking_id=b.id
      join customer_events e on e.booking_id=b.id and e.event_type='booking'
      where b.id=$1::uuid
    `, [saved.bookingId]);
    expect(details.rows).toHaveLength(1);
    expect(details.rows[0]).toMatchObject({
      status: "requested", name: "Synthetic no-OTP bride",
      phone: "+46700000000", verified: false,
    });
    expect(details.rows[0]?.reference).toMatch(/^MBM-[0-9]{10,}$/);
  });

  it("cannot issue a verified-review invitation for a manually completed no-OTP booking", async () => {
    const saved = await createMariaUnverifiedBookingRequest(request("review-unverified@example.invalid"));
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error("Synthetic no-OTP request was not saved");
    await db!.query(
      "update bookings set status='completed' where id=$1::uuid and workspace_id=$2",
      [saved.bookingId, workspaceId],
    );
    // Exercise the real production invitation SQL on the disposable canonical schema.
    const issued = await persistReviewInvitation({
      sql: mocks.getSql(),
      actorUserId: randomUUID(),
      workspaceId,
      bookingId: saved.bookingId,
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(issued).toHaveLength(1);
    expect(issued[0]?.target_exists).toBe(false);
    expect(issued[0]?.invitation_id).toBeNull();
    const count = await db!.query<{ count: number }>(
      "select count(*)::int as count from website_review_invitations " +
      "where workspace_id=$1::uuid and booking_id=$2::uuid",
      [workspaceId, saved.bookingId],
    );
    expect(count.rows[0]?.count).toBe(0);
  });

  it("rejects an existing overlapping booking without creating dependent rows", async () => {
    const c = await db!.query<{ id: string }>(
      "insert into customers(workspace_id,name,email,status) " +
        "values($1,'Busy QA','busy@example.invalid','active') returning id::text",
      [workspaceId],
    );
    const overlappingStart = new Date(Date.parse(startsAt) + 30 * 60_000).toISOString();
    await db!.query(
      "insert into bookings(workspace_id,customer_id,title,service,service_id," +
        "status,source,starts_at,ends_at) " +
        "values($1,$2::uuid,'Busy QA','Synthetic bridal makeup',$3::uuid," +
        "'confirmed','public_booking',$4::timestamptz,$5::timestamptz)",
      [workspaceId,c.rows[0]!.id,serviceId,overlappingStart,
        new Date(Date.parse(overlappingStart) + 180 * 60_000).toISOString()],
    );
    const before = await snapshot();
    expect(await createMariaUnverifiedBookingRequest(request())).toMatchObject({
      ok: false, error: "conflict",
    });
    expect(await snapshot()).toEqual(before);
  });

  it("rejects an active verification hold without creating dependent rows", async () => {
    await db!.query(
      "insert into public_booking_verifications(workspace_id,public_booking_slug," +
        "customer_name,customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at) " +
        "values($1::uuid,'makeup-by-maria','Held QA','held@example.invalid',$2::uuid," +
        "'Synthetic bridal makeup',$3::timestamptz,$4::timestamptz,'held-hash'," +
        "now()+interval '15 minutes')",
      [workspaceId,serviceId,startsAt,endsAt],
    );
    const before = await snapshot();
    expect(await createMariaUnverifiedBookingRequest(request())).toMatchObject({
      ok: false, error: "conflict",
    });
    expect(await snapshot()).toEqual(before);
    expect((await db!.query(
      "select count(*)::int as count from public_booking_verifications " +
        "where workspace_id=$1::uuid and consumed_at is null",
      [workspaceId],
    )).rows[0]?.count).toBe(1);
  });

  it("rejects a manually closed slot without creating dependent rows", async () => {
    await db!.query(
      "insert into maria_manual_closed_starts(workspace_id,starts_at,created_by) " +
        "values($1::uuid,$2::timestamptz,'synthetic-qa')",
      [workspaceId,startsAt],
    );
    const before = await snapshot();
    expect(await createMariaUnverifiedBookingRequest(request())).toMatchObject({
      ok: false, error: "conflict",
    });
    expect(await snapshot()).toEqual(before);
  });

  it("serializes two simultaneous requests for the same slot: exactly one commits", async () => {
    const results = await Promise.all([
      createMariaUnverifiedBookingRequest(request("bride-one@example.invalid")),
      createMariaUnverifiedBookingRequest(request("bride-two@example.invalid")),
    ]);
    expect(results.filter(value => value.ok)).toHaveLength(1);
    expect(results.filter(value => !value.ok)).toHaveLength(1);
    expect(results.find(value => !value.ok)).toMatchObject({ ok: false, error: "conflict" });
    expect(await snapshot()).toEqual({ bookings: 1, customers: 1, references: 1, events: 1 });
  }, 30_000);
});
