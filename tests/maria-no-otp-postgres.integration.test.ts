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
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspaceFeatureAccessForWorkspace: vi.fn(async () => true),
}));

import { createMariaUnverifiedBookingRequest, finalizeMariaVerifiedBooking } from "@/lib/maria-verified-booking";
import { persistReviewInvitation } from "@/lib/verified-review-persistence";
import { submitVerifiedReview } from "@/lib/verified-review-invitations";
import { createVerifiedReviewToken, hashVerifiedReviewToken } from "@/lib/verified-review-token";

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
    await db!.query("delete from website_reviews where workspace_id=$1::uuid", [workspaceId]);
    await db!.query("delete from website_review_invitations where workspace_id=$1::uuid", [workspaceId]);
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

  async function verifiedHold(email: string, name: string, phone: string) {
    const nextFriday = new Date(Date.parse(day + "T12:00:00Z") + 7 * 86_400_000)
      .toISOString().slice(0, 10);
    const start = mariaCalendarIntervals(nextFriday, "06:00", "10:00")!
      .find(item => item.clock === "07:00")!.startsAt;
    const end = new Date(Date.parse(start) + 180 * 60_000).toISOString();
    const hold = await db!.query<{ id: string }>(
      "insert into public_booking_verifications(" +
        "workspace_id,public_booking_slug,customer_name,customer_email,customer_phone," +
        "service_id,service_name,starts_at,ends_at,code_hash,expires_at) " +
        "values($1::uuid,'makeup-by-maria',$2,$3,$4,$5::uuid," +
        "'Synthetic bridal makeup',$6::timestamptz,$7::timestamptz,'verified-hash'," +
        "now()+interval '15 minutes') returning id::text",
      [workspaceId, name, email, phone, serviceId, start, end],
    );
    return finalizeMariaVerifiedBooking({
      verificationId: hold.rows[0]!.id, expectedCodeHash: "verified-hash",
      bookingNote: "Synthetic verified QA",
    });
  }

  it("does not adopt forged no-OTP contact details when email owner later verifies via OTP", async () => {
    const email = "owner-later-verified@example.invalid";
    const unverified = await createMariaUnverifiedBookingRequest(request(email));
    expect(unverified.ok).toBe(true);
    if (!unverified.ok) throw new Error("Synthetic no-OTP request was not saved");

    const verified = await verifiedHold(email, "Real verified bride", "+46705555555");
    expect(verified.ok).toBe(true);
    if (!verified.ok) throw new Error("Synthetic OTP finalization failed");
    expect(verified.customerId).not.toBe(unverified.customerId);
    expect(await snapshot()).toEqual({ bookings: 2, customers: 2, references: 2, events: 2 });

    const contacts = await db!.query<{id: string; name: string; phone: string}>(
      "select id::text,name,phone from customers where workspace_id=$1 order by id",
      [workspaceId],
    );
    expect(contacts.rows).toEqual(expect.arrayContaining([
      { id: unverified.customerId, name: "Synthetic no-OTP bride", phone: "+46700000000" },
      { id: verified.customerId, name: "Real verified bride", phone: "+46705555555" },
    ]));
    const events = await db!.query<{ verified_mode: string | null; verification_id: string | null }>(
      "select e.metadata->>'verification_mode' as verified_mode, " +
        "e.metadata->>'verification_id' as verification_id from customer_events e " +
        "where e.booking_id=$1::uuid and e.customer_id=$2::uuid",
      [verified.bookingId, verified.customerId],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]?.verification_id).toBeTruthy();
    expect(events.rows[0]?.verified_mode).toBeNull();
  });

  it("preserves a previously established customer when an unverified duplicate shares the email", async () => {
    const email = "established@example.invalid";
    const existing = await db!.query<{id:string}>(
      "insert into customers(workspace_id,name,email,phone,status,source) " +
        "values($1,'Established CRM customer',$2,'+46701111111','active','dashboard_manual') " +
        "returning id::text", [workspaceId, email],
    );
    const unverified = await createMariaUnverifiedBookingRequest(request(email));
    expect(unverified.ok).toBe(true);
    const verified = await verifiedHold(email, "Later OTP submitter", "+46702222222");
    expect(verified.ok).toBe(true);
    if (!verified.ok || !unverified.ok) throw new Error("Synthetic request did not finalize");
    expect(verified.customerId).toBe(existing.rows[0]!.id);
    expect(verified.customerId).not.toBe(unverified.customerId);
    expect((await db!.query(
      "select name,phone from customers where id=$1::uuid",
      [existing.rows[0]!.id],
    )).rows[0]).toMatchObject({
      name: "Established CRM customer", phone: "+46701111111",
    });
    expect(await snapshot()).toEqual({ bookings: 2, customers: 2, references: 2, events: 2 });
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


  // Simulate a legacy review invitation minted before no-OTP provenance was
  // enforced. Run the public submit handler against the canonical throwaway
  // database, not a mocked SQL result.
  async function pendingReviewToken(bookingId: string, customerId: string) {
    const token = createVerifiedReviewToken();
    await db!.query(
      "insert into website_review_invitations(" +
        "workspace_id,booking_id,customer_id,token_hash,status,expires_at) " +
        "values($1::uuid,$2::uuid,$3::uuid,$4,'pending',now()+interval '1 day')",
      [workspaceId,bookingId,customerId,hashVerifiedReviewToken(token)],
    );
    return token;
  }

  const reviewSubmission = () => ({
    reviewerName: "Synthetic review author",
    rating: 5,
    message: "Synthetic regression only, no real customer",
    consent: true as const,
    website: "",
    formStartedAt: Date.now() - 5000,
  });

  it("rejects a legacy pending review token after a no-OTP booking is manually completed", async () => {
    const saved = await createMariaUnverifiedBookingRequest(request("old-review-token@example.invalid"));
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error("Synthetic no-OTP creation failed");
    await db!.query(
      "update bookings set status='completed' where id=$1::uuid and workspace_id=$2",
      [saved.bookingId,workspaceId],
    );
    const token = await pendingReviewToken(saved.bookingId,saved.customerId);
    expect(await submitVerifiedReview(token,reviewSubmission()))
      .toEqual({ ok: false, code: "unavailable" });
    const rows = await db!.query<{ status: string; count: number }>(
      "select status,(select count(*)::int from website_reviews " +
        "where workspace_id=$1::uuid) as count from website_review_invitations " +
        "where token_hash=$2",
      [workspaceId,hashVerifiedReviewToken(token)],
    );
    expect(rows.rows).toEqual([{ status: "pending", count: 0 }]);
  });

  it("preserves successful verified-review submission for a normal OTP-verified booking", async () => {
    const verified = await verifiedHold(
      "legitimate-review@example.invalid", "Verified QA customer", "+46707777777",
    );
    expect(verified.ok).toBe(true);
    if (!verified.ok) throw new Error("Synthetic OTP booking failed");
    await db!.query(
      "update bookings set status='completed' where id=$1::uuid and workspace_id=$2",
      [verified.bookingId,workspaceId],
    );
    const token = await pendingReviewToken(verified.bookingId,verified.customerId);
    const submitted = await submitVerifiedReview(token,reviewSubmission());
    expect(submitted.ok).toBe(true);
    const rows = await db!.query<{ status: string; is_verified: boolean; count: number }>(
      "select i.status,r.is_verified, " +
        "(select count(*)::int from website_reviews where workspace_id=$1::uuid) as count " +
        "from website_review_invitations i join website_reviews r " +
        "on r.review_invitation_id=i.id where i.token_hash=$2",
      [workspaceId,hashVerifiedReviewToken(token)],
    );
    expect(rows.rows).toEqual([{ status: "used", is_verified: true, count: 1 }]);
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

  it("limits temporary unverified pending requests to ten across different slots", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const nextFriday = new Date(Date.parse(day + "T12:00:00Z") + i * 7 * 86_400_000)
        .toISOString().slice(0, 10);
      const nextSlot = mariaCalendarIntervals(nextFriday, "06:00", "10:00")!
        .find(item => item.clock === "07:00")!;
      const candidate = {
        ...request("cap-" + i + "@example.invalid"),
        startsAt: nextSlot.startsAt,
        endsAt: new Date(Date.parse(nextSlot.startsAt) + 180 * 60_000).toISOString(),
      };
      const saved = await createMariaUnverifiedBookingRequest(candidate);
      expect(saved.ok).toBe(true);
      if (!saved.ok) throw new Error("A synthetic capacity fixture was rejected");
      // Exactly the tenth successful request triggers the manager-capacity notice.
      expect(saved.capacityReached).toBe(i === 9);
      ids.push(saved.bookingId);
    }
    expect(await snapshot()).toEqual({ bookings: 10, customers: 10, references: 10, events: 10 });

    const deniedFriday = new Date(Date.parse(day + "T12:00:00Z") + 10 * 7 * 86_400_000)
      .toISOString().slice(0, 10);
    const deniedSlot = mariaCalendarIntervals(deniedFriday, "06:00", "10:00")!
      .find(item => item.clock === "07:00")!;
    const eleventh = {
      ...request("cap-eleventh@example.invalid"),
      startsAt: deniedSlot.startsAt,
      endsAt: new Date(Date.parse(deniedSlot.startsAt) + 180 * 60_000).toISOString(),
    };
    const before = await snapshot();
    expect(await createMariaUnverifiedBookingRequest(eleventh)).toMatchObject({
      ok: false, error: "conflict",
    });
    expect(await snapshot()).toEqual(before);

    // Manual confirmation frees one pending intake slot without deleting
    // any booking or disrupting the established manager approval flow.
    await db!.query("update bookings set status='confirmed' where id=$1::uuid", [ids[0]]);
    expect(await createMariaUnverifiedBookingRequest(eleventh)).toMatchObject({
      ok: true, capacityReached: true,
    });
    expect(await snapshot()).toEqual({ bookings: 11, customers: 11, references: 11, events: 11 });
  }, 90_000);

  it("rejects notice that expires while an unverified request waits for the workspace lock", async () => {
    const before = await snapshot();
    await db!.query(
      "update workspace_services set minimum_notice_minutes=2 where id=$1::uuid",
      [serviceId],
    );
    // The candidate is valid for 5 seconds before it breaches the notice
    // boundary. Its weekday is added only in this disposable PostgreSQL.
    const dbClock = await db!.query<{ checked_at: Date }>(
      "select clock_timestamp() as checked_at",
    );
    const candidateStartsAt = new Date(new Date(dbClock.rows[0]!.checked_at).getTime() + 125_000);
    const candidateEndsAt = new Date(candidateStartsAt.getTime() + 180 * 60_000);
    const deadline = candidateStartsAt.getTime() - 120_000;
    const weekday = await db!.query<{ day: number }>(
      "select extract(dow from $1::timestamptz at time zone 'Europe/Stockholm')::int as day",
      [candidateStartsAt.toISOString()],
    );
    await db!.query(
      "insert into workspace_booking_hours(workspace_id,weekday,opens_at,closes_at,is_closed) " +
      "values($1,$2,'00:00','23:59',false) on conflict(workspace_id,weekday) do update " +
      "set opens_at='00:00',closes_at='23:59',is_closed=false",
      [workspaceId, weekday.rows[0]!.day],
    );

    const holder = new Client({ connectionString });
    await holder.connect();
    let pending: ReturnType<typeof createMariaUnverifiedBookingRequest> | undefined;
    try {
      await holder.query("BEGIN");
      await holder.query(
        "select pg_advisory_xact_lock(hashtextextended($1::text,713))",
        [workspaceId],
      );
      pending = createMariaUnverifiedBookingRequest({
        ...request("notice-locked@example.invalid"),
        startsAt: candidateStartsAt.toISOString(),
        endsAt: candidateEndsAt.toISOString(),
      });
      let startedBeforeDeadline = false;
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const observed = await db!.query<{ transaction_started: Date }>(`
          select xact_start as transaction_started from pg_stat_activity
          where pid <> pg_backend_pid() and pid <> $1
            and state='active' and wait_event_type='Lock' and wait_event='advisory'
            and query like '%pg_advisory_xact_lock%'
          limit 1
        `, [holder.processID]);
        if (observed.rows.length) {
          blocked = true;
          startedBeforeDeadline =
            new Date(observed.rows[0]!.transaction_started).getTime() < deadline;
          break;
        }
        await delay(30);
      }
      expect(blocked).toBe(true);
      expect(startedBeforeDeadline).toBe(true);
      // Cross the threshold *while* the transaction is waiting. A PostgreSQL
      // now() comparison would still see the earlier transaction-start time.
      const afterWaitClock = await db!.query<{ checked_at: Date }>(
        "select clock_timestamp() as checked_at",
      );
      await delay(Math.max(0, deadline + 400
        - new Date(afterWaitClock.rows[0]!.checked_at).getTime()));
      await holder.query("COMMIT");
      const outcome = await pending;
      expect(outcome).toMatchObject({ ok: false, error: "conflict" });
      expect(await snapshot()).toEqual(before);
    } finally {
      await holder.query("ROLLBACK").catch(() => undefined);
      await pending?.catch(() => undefined);
      await holder.end();
    }
  }, 30_000);

  it("observes two PostgreSQL advisory-lock waiters before admitting one request", async () => {
    const coordinator = new Client({ connectionString });
    await coordinator.connect();
    let pending: Promise<Awaited<ReturnType<typeof createMariaUnverifiedBookingRequest>>[]> | undefined;
    try {
      await coordinator.query("BEGIN");
      await coordinator.query("select pg_advisory_xact_lock(hashtextextended($1::text,713))", [workspaceId]);
      pending = Promise.all([
        createMariaUnverifiedBookingRequest(request("bride-one@example.invalid")),
        createMariaUnverifiedBookingRequest(request("bride-two@example.invalid")),
      ]);
      let waiting = 0;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await db!.query<{ count: number }>(`
          select count(*)::int as count from pg_stat_activity
          where pid <> pg_backend_pid()
            and state='active' and wait_event_type='Lock' and wait_event='advisory'
            and query like '%pg_advisory_xact_lock%'
        `);
        waiting = result.rows[0]?.count ?? 0;
        if (waiting >= 2) break;
        await delay(50);
      }
      expect(waiting).toBeGreaterThanOrEqual(2);
      await coordinator.query("COMMIT");
      const results = await pending;
      expect(results.filter(value => value.ok)).toHaveLength(1);
      expect(results.filter(value => !value.ok)).toHaveLength(1);
      expect(results.find(value => !value.ok)).toMatchObject({ ok: false, error: "conflict" });
      expect(await snapshot()).toEqual({ bookings: 1, customers: 1, references: 1, events: 1 });
    } finally {
      await coordinator.query("ROLLBACK").catch(() => undefined);
      await pending?.catch(() => undefined);
      await coordinator.end();
    }
  }, 30_000);
});
