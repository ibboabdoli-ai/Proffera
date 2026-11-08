import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

type Query = { text: string; values: unknown[] };
type QueryResponse = Record<string, unknown>[];
const runtime = vi.hoisted(() => ({
  makeSql: undefined as undefined | (() => unknown),
  workspaceId: "",
  workspaceSlug: "makeup-by-maria",
  userId: "maria-qa-manager",
  role: "owner",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-secret", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth-secret")>()),
  resolveCustomerPortalSecret: () => "synthetic-maria-postgres-portal-test-only",
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => runtime.makeSql?.() ?? null,
}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic-manager-test-only.invalid",
}));
vi.mock("@/lib/db/server", () => ({
  getSql: () => runtime.makeSql?.() ?? null,
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, workspaceId: runtime.workspaceId, workspaceSlug: runtime.workspaceSlug,
    userId: runtime.userId, role: runtime.role,
  }),
  canManageWorkspaceSettings: (access: { ok: boolean; role: string }) =>
    access.ok && (access.role === "owner" || access.role === "admin"),
}));
vi.mock("@/lib/workspace-module-access", () => ({
  hasDashboardModuleAccess: async (moduleId: string) => moduleId === "online_booking",
}));
vi.mock("@/lib/maria-booking-runtime", () => ({
  // This suite verifies PostgreSQL booking writes and conflicts with a
  // synthetic, already-authorized Preview workspace. Readiness/entitlement
  // policy is covered in its own tests, not synthesized from missing plans.
  getMariaBookingReadiness: async () => process.env.VERCEL_ENV === "preview"
    ? { enabled: true, workspaceId: runtime.workspaceId, publicSlug: "makeup-by-maria" }
    : { enabled: false },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error("TEST_REDIRECT:" + url); },
}));

import { readMariaManualSwishStatuses, setMariaManualSwishStatus } from "@/lib/maria-manual-swish";
import { cancelCustomerCalendarBooking, createCustomerCalendarToken } from "@/lib/customer-calendar";
import { mariaBookingNumber } from "@/lib/maria-deposit";
import { readMariaSwishQrEligibility } from "@/lib/maria-swish-qr-eligibility";
import { saveMariaYearAction } from "@/app/dashboard/maria/actions";
import { GET as getMariaPublicConfig } from "@/app/api/makeup-by-maria/config/route";
import { saveMariaProductionYearAction } from "@/app/dashboard/maria/production-year-actions";
import { mariaDefaultCardCopy } from "@/lib/maria-default-card-copy";
import { readMariaCardTranslations } from "@/lib/maria-card-translations-db";
import { saveMariaScheduleAction } from "@/app/dashboard/maria/schedule-actions";
import { rescheduleMariaDashboardBooking } from "@/lib/maria-dashboard-reschedule";
import { BookingTimeConflictError, createDashboardBooking } from "@/lib/dashboard-db";
import { createDashboardAvailabilityBlock, createDashboardRecurringAvailabilityBlocks } from "@/lib/dashboard-availability-blocks";

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
      "insert into customers (id, workspace_id, name, email, status, source) values ($1::uuid, $2, 'Synthetic Maria customer', 'qa@example.invalid', 'active', 'dashboard_manual')",
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

  // A failing negative assertion must not leave a revoked QA inbox or
  // Production environment active for the next real-PostgreSQL test.
  beforeEach(() => {
    runtime.workspaceId = workspaceId;
    runtime.workspaceSlug = "makeup-by-maria";
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "qa.vercel.app");
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "qa@example.invalid");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records, reads, deduplicates and reverses the human-verified Swish deposit", async () => {
    expect((await readMariaManualSwishStatuses()).entries[bookingId]?.state).toBe("unverified");
    expect(await setMariaManualSwishStatus(bookingId, "paid")).toEqual({ changed: true });
    expect((await readMariaManualSwishStatuses()).entries[bookingId]?.state).toBe("paid");
    expect(await setMariaManualSwishStatus(bookingId, "paid")).toEqual({ changed: false });
    expect(await setMariaManualSwishStatus(bookingId.toUpperCase(), "paid")).toEqual({ changed: false });
    const paid = await db!.query<{ metadata: { state: string; amount_minor: number; booking_number: string; actor_user_id: string } }>(
      "select metadata from customer_events where workspace_id=$1 and booking_id=$2::uuid and metadata->>'source'='maria_swish_manual_deposit_v1'",
      [workspaceId, bookingId],
    );
    expect(paid.rowCount).toBe(1);
    expect(paid.rows[0]?.metadata).toMatchObject({
      state: "paid", amount_minor: 200000,
      booking_number: mariaBookingNumber(bookingId),
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
    form.set("trial_description_en", "Bridal makeup with trial QA");
    form.set("trial_description_ar", "مكياج عروس مع تجربة للاختبار");
    form.set("without_description_en", "Bridal makeup without trial QA");
    form.set("without_description_ar", "مكياج عروس بدون تجربة للاختبار");
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

    const cardCopy = await readMariaCardTranslations(workspaceId);
    expect(cardCopy.get("maria-bridal-trial-2026")).toEqual({
      en: "Bridal makeup with trial QA", ar: "مكياج عروس مع تجربة للاختبار",
    });
    expect(cardCopy.get("maria-bridal-without-trial-2026")).toEqual({
      en: "Bridal makeup without trial QA", ar: "مكياج عروس بدون تجربة للاختبار",
    });
    expect(trial?.short_description).toBe("Brudmakeup med provsminkning");

    await db!.query(
      "update workspace_services set public_status='published' where workspace_id=$1 and public_slug='maria-bridal-trial-2026'",
      [workspaceId],
    );
    form.set("trial", "6900.75");
    form.set("trial_description_ar", "");
    await expect(saveMariaYearAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2026&year=2026#priser");
    const updated = await db!.query(
      "select price_amount_minor,base_price_sek,public_status from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2026'",
      [workspaceId],
    );
    expect(Number(updated.rows[0]?.price_amount_minor)).toBe(690075);
    expect(updated.rows[0]?.base_price_sek).toBeNull();
    expect(updated.rows[0]?.public_status).toBe("published");
    // Blank Arabic restores the default; English remains as saved.
    expect((await readMariaCardTranslations(workspaceId)).get("maria-bridal-trial-2026"))
      .toEqual({ en: "Bridal makeup with trial QA", ar: "" });

    // Clearing the Swedish fields restores exactly what the public Design 02
    // already displays, not the older abbreviated fallback text.
    form.set("trial_description", "");
    form.set("without_description", "");
    await expect(saveMariaYearAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2026&year=2026#priser");
    const reset = await db!.query<{public_slug:string;short_description:string}>(
      "select public_slug,short_description from workspace_services where workspace_id=$1 and public_slug in ('maria-bridal-trial-2026','maria-bridal-without-trial-2026')",
      [workspaceId],
    );
    expect(reset.rows.find(row => row.public_slug === "maria-bridal-trial-2026")?.short_description)
      .toBe(mariaDefaultCardCopy.trial.sv);
    expect(reset.rows.find(row => row.public_slug === "maria-bridal-without-trial-2026")?.short_description)
      .toBe(mariaDefaultCardCopy["without-trial"].sv);
    expect((await readMariaCardTranslations(workspaceId)).get("maria-bridal-trial-2026"))
      .toEqual({ en: "Bridal makeup with trial QA", ar: "" });
  });
  it("preserves a single active package when its year's price or text is saved", async () => {
    const year = 2031;
    const slugs = [`maria-bridal-trial-${year}`, `maria-bridal-without-trial-${year}`];
    await db!.query(
      `insert into workspace_services(workspace_id,name,public_slug,short_description,
         price_type,price_amount_minor,base_price_sek,is_active,public_status)
       values($1,$2,$3,'Synthetic QA trial','fixed',690000,6900,true,'published')`,
      [workspaceId,`Brudsmink med prov ${year}`,slugs[0]],
    );
    const form = (initial: string, active: boolean) => {
      const data = new FormData();
      data.set("year",String(year));
      data.set("enabled_original",initial);
      if(active)data.set("enabled","on");
      data.set("trial","6900.50");
      data.set("without","5800");
      for(const field of ["trial_description","without_description","trial_description_en",
        "trial_description_ar","without_description_en","without_description_ar"]) {
        data.set(field,"Synthetic QA content");
      }
      return data;
    };
    const statuses = async () => (await db!.query<{public_slug:string;is_active:boolean}>(
      "select public_slug,is_active from workspace_services where workspace_id=$1 and public_slug=any($2::text[]) order by public_slug",
      [workspaceId,slugs],
    )).rows;
    try {
      await expect(saveMariaYearAction(form("true",true)))
        .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2031&year=2031#priser");
      expect((await statuses()).map(row=>row.is_active)).toEqual([true,false]);
      await expect(saveMariaYearAction(form("true",false)))
        .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2031&year=2031#priser");
      expect((await statuses()).map(row=>row.is_active)).toEqual([false,false]);
      await expect(saveMariaYearAction(form("false",true)))
        .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2031&year=2031#priser");
      expect((await statuses()).map(row=>row.is_active)).toEqual([true,true]);
    } finally {
      await db!.query("delete from workspace_services where workspace_id=$1 and public_slug=any($2::text[])",[workspaceId,slugs]);
    }
  });

  it("Production public config excludes drafts and never invents unpublished 2026 prices", async () => {
    const draft = "maria-bridal-trial-2033";
    const published = "maria-bridal-without-trial-2033";
    await db!.query(
      `insert into workspace_services(workspace_id,name,public_slug,price_type,
         price_amount_minor,is_active,public_status,duration_minutes)
       values($1,'QA unpublished 2033',$2,'fixed',990000,true,'draft',180),
             ($1,'QA published 2033',$3,'fixed',680000,true,'published',180)`,
      [workspaceId,draft,published],
    );
    try {
      vi.stubEnv("VERCEL_ENV","production");
      const payload = await (await getMariaPublicConfig()).json();
      const item = (payload.years as Array<{year:number;trial:number|null;without:number|null}>)
        .find(year=>year.year===2033);
      expect(payload.previewOnly).toBe(false);
      expect(item).toMatchObject({year:2033,trial:null,without:6800});
      expect(payload.editorPreview).toBe(false);
      vi.stubEnv("VERCEL_ENV","preview");
      const preview = await (await getMariaPublicConfig()).json();
      const draftYear = (preview.years as Array<{year:number;trial:number|null;without:number|null}>)
        .find(year=>year.year===2033);
      expect(draftYear).toMatchObject({trial:9900,without:6800});
    } finally {
      await db!.query("delete from workspace_services where workspace_id=$1 and public_slug in ($2,$3)",
        [workspaceId,draft,published]);
    }
  });

  it("does not publish 2026 draft prices through the Production public config", async () => {
    const existing = (await db!.query<{public_slug:string;public_status:string}>(
      "select public_slug,public_status from workspace_services where workspace_id=$1 and public_slug in ('maria-bridal-trial-2026','maria-bridal-without-trial-2026')",
      [workspaceId],
    )).rows;
    expect(existing.length).toBe(2);
    try {
      await db!.query(
        "update workspace_services set public_status='draft' where workspace_id=$1 and public_slug in ('maria-bridal-trial-2026','maria-bridal-without-trial-2026')",
        [workspaceId],
      );
      vi.stubEnv("VERCEL_ENV","production");
      const payload = await (await getMariaPublicConfig()).json();
      expect((payload.years as Array<{year:number}>).find(row=>row.year===2026)).toBeUndefined();
      expect(payload.prices2026).toEqual({});
    } finally {
      for (const row of existing) {
        await db!.query(
          "update workspace_services set public_status=$3 where workspace_id=$1 and public_slug=$2",
          [workspaceId,row.public_slug,row.public_status],
        );
      }
    }
  });

  it("hides and refuses a booking when the approved Preview recipient changes", async () => {
    const count = () => db!.query<{ count: number }>(
      "select count(*)::int as count from customer_events where workspace_id=$1 and booking_id=$2::uuid and metadata->>'source'='maria_swish_manual_deposit_v1'",
      [workspaceId, bookingId],
    );
    const before = Number((await count()).rows[0]?.count);
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "different-qa@example.invalid");
    // A mismatch between the Maria allowlist and the effective Brevo inbox
    // is now a configuration-level failure, not a successful empty read.
    expect(await readMariaManualSwishStatuses()).toEqual({ ok: false, entries: {} });
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_FORBIDDEN");
    expect(Number((await count()).rows[0]?.count)).toBe(before);
  });

  it("shows Production manual-booking payment instructions only after separate Swish activation", async () => {
    vi.stubEnv("VERCEL_ENV","production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED","true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN","https://makeupbymaria.se");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_SWISH_ENABLED",undefined);
    expect(await readMariaSwishQrEligibility(bookingId)).toBe("unavailable");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_SWISH_ENABLED","true");
    expect(await readMariaSwishQrEligibility(bookingId)).toBe("eligible");
  });

  it("fails closed if the effective Brevo inbox differs from the Maria allowlist", async () => {
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "other@example.invalid");
    expect(await readMariaManualSwishStatuses()).toEqual({ ok: false, entries: {} });
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_FORBIDDEN");
  });

  it("fails closed when no Preview recipient is configured", async () => {
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "");
    expect(await readMariaManualSwishStatuses()).toEqual({ ok: false, entries: {} });
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_FORBIDDEN");
  });

  it("refuses a cancelled booking without leaving cancelled fixture state behind", async () => {
    await db!.query("update bookings set status='cancelled' where id=$1::uuid and workspace_id=$2", [bookingId, workspaceId]);
    try {
      await expect(setMariaManualSwishStatus(bookingId, "paid"))
        .rejects.toThrow("MARIA_MANUAL_SWISH_INELIGIBLE");
    } finally {
      await db!.query("update bookings set status='confirmed' where id=$1::uuid and workspace_id=$2", [bookingId, workspaceId]);
    }
  });

  it("rejects year name/slug collisions atomically without a partial package or audit", async () => {
    await db!.query(
      "insert into workspace_services (workspace_id,name,public_slug,duration_minutes) values ($1,'Brudsmink med prov 2027','synthetic-conflicting-slug-2027',180)",
      [workspaceId],
    );
    const beforeAudit = await db!.query<{ count: number }>(
      "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
      [workspaceId],
    );
    const form = new FormData();
    form.set("year", "2027"); form.set("enabled", "on");
    form.set("trial", "7000"); form.set("without", "6000");
    form.set("trial_description", "QA with trial");
    form.set("without_description", "QA without trial");
    form.set("trial_description_en", "QA trial English");
    form.set("trial_description_ar", "تجربة");
    form.set("without_description_en", "QA without English");
    form.set("without_description_ar", "بدون تجربة");
    await expect(saveMariaYearAction(form)).rejects.toThrow("TEST_REDIRECT:/dashboard/maria?error=save");
    const rows = await db!.query(
      "select public_slug from workspace_services where workspace_id=$1 and public_slug like 'maria-bridal-%-2027'",
      [workspaceId],
    );
    expect(rows.rowCount).toBe(0);
    const invalidTranslations = await db!.query(
      "select t.service_id from maria_service_card_translations t join workspace_services s on s.id=t.service_id where s.workspace_id=$1 and s.public_slug like 'maria-bridal-%-2027'",
      [workspaceId],
    );
    expect(invalidTranslations.rowCount).toBe(0);
    const afterAudit = await db!.query<{ count: number }>(
      "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
      [workspaceId],
    );
    expect(afterAudit.rows[0]?.count).toBe(beforeAudit.rows[0]?.count);
  });

  it("rejects incomplete Swedish fields atomically before overwriting multilingual card copy", async () => {
    const names = [
      "trial_description", "without_description",
      "trial_description_en", "trial_description_ar",
      "without_description_en", "without_description_ar",
    ] as const;
    const beforeAudit = await db!.query<{ count: number }>(
      "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
      [workspaceId],
    );
    for (const missing of ["trial_description", "without_description"]) {
      const form = new FormData();
      form.set("year", "2034");
      form.set("enabled", "on");
      form.set("trial", "6900");
      form.set("without", "5800");
      for (const name of names) form.set(name, "Synthetic QA description " + name);
      form.delete(missing);
      await expect(saveMariaYearAction(form))
        .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?error=description");
      const services = await db!.query<{ count: number }>(
        "select count(*)::int as count from workspace_services where workspace_id=$1 and public_slug in ('maria-bridal-trial-2034','maria-bridal-without-trial-2034')",
        [workspaceId],
      );
      expect(services.rows[0]?.count).toBe(0);
      const afterAudit = await db!.query<{ count: number }>(
        "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
        [workspaceId],
      );
      expect(afterAudit.rows[0]?.count).toBe(beforeAudit.rows[0]?.count);
    }
  });

  it("blocks all settings writes if translation storage is missing", async () => {
    const name = "maria_service_card_translations";
    const backupName = "maria_service_card_translations_qa_hidden";
    const before = await db!.query<{count:number}>(
      "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
      [workspaceId],
    );
    await db!.query(`alter table ${name} rename to ${backupName}`);
    try {
      const form = new FormData();
      form.set("year", "2035"); form.set("enabled", "on");
      form.set("trial", "7000"); form.set("without", "6000");
      for (const field of [
        "trial_description", "without_description", "trial_description_en",
        "trial_description_ar", "without_description_en", "without_description_ar",
      ]) form.set(field, "Synthetic QA text");
      await expect(saveMariaYearAction(form))
        .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?error=translation_setup");
      expect(await readMariaCardTranslations(workspaceId)).toEqual(new Map());
      // The public display may fall back, but the editable manager must not.
      await expect(readMariaCardTranslations(workspaceId, {strict:true}))
        .rejects.toMatchObject({code:"42P01"});
      const created = await db!.query<{count:number}>(
        "select count(*)::int as count from workspace_services where workspace_id=$1 and public_slug in ('maria-bridal-trial-2035','maria-bridal-without-trial-2035')",
        [workspaceId],
      );
      expect(created.rows[0]?.count).toBe(0);
      const audit = await db!.query<{count:number}>(
        "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
        [workspaceId],
      );
      expect(audit.rows[0]?.count).toBe(before.rows[0]?.count);
    } finally {
      await db!.query(`alter table ${backupName} rename to ${name}`);
    }
  });

  it("never reads or writes another workspace's matching bridal slugs", async () => {
    const otherId = randomUUID();
    const otherSlug = "unrelated-qa-" + otherId.slice(0, 8);
    await db!.query(
      "insert into workspaces (id,slug,public_booking_slug,name,status) values ($1::uuid,$2,$2,'Unrelated QA Workspace','active')",
      [otherId, otherSlug],
    );
    await db!.query(
      "insert into workspace_services(workspace_id,name,public_slug,short_description,is_active,public_status) values ($1,'Other QA trial','maria-bridal-trial-2026','Keep other tenant copy',true,'draft'),($1,'Other QA without','maria-bridal-without-trial-2026','Other copy',true,'draft')",
      [otherId],
    );
    const otherSeed = await db!.query(
      "insert into maria_service_card_translations(service_id,locale,description) select id,'en','Other tenant translation' from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2026' returning service_id",
      [otherId],
    );
    expect(otherSeed.rowCount).toBe(1);
    // Existing foreign-tenant copy must not leak into Maria's reader.
    expect(await readMariaCardTranslations(otherId)).toEqual(new Map());
    const otherRows = await db!.query<{count:number}>(
      "select count(*)::int as count from maria_service_card_translations t join workspace_services s on s.id=t.service_id where s.workspace_id=$1",
      [otherId],
    );
    expect(otherRows.rows[0]?.count).toBe(1);
    const otherServices = await db!.query<{count:number}>(
      "select count(*)::int as count from workspace_services where workspace_id=$1 and public_slug like 'maria-bridal-%'",
      [otherId],
    );
    expect(otherServices.rows[0]?.count).toBe(2);
    const form = new FormData();
    form.set("year", "2026"); form.set("trial", "9500"); form.set("without", "9000");
    for (const field of [
      "trial_description", "without_description", "trial_description_en",
      "trial_description_ar", "without_description_en", "without_description_ar",
    ]) form.set(field, "Should never save");
    try {
      runtime.workspaceId = otherId;
      // Keep the authenticated Maria slug while changing only the tenant ID.
      // This reaches the SQL-level workspace.slug protection and must roll back.
      await expect(saveMariaYearAction(form)).rejects.toThrow("TEST_REDIRECT:/dashboard/maria?error=save");
      expect(await readMariaCardTranslations(otherId)).toEqual(new Map());
    } finally {
      runtime.workspaceId = workspaceId;
      runtime.workspaceSlug = "makeup-by-maria";
    }
    const unchanged = await db!.query<{count:number}>(
      "select count(*)::int as count from maria_service_card_translations t join workspace_services s on s.id=t.service_id where s.workspace_id=$1",
      [otherId],
    );
    expect(unchanged.rows[0]?.count).toBe(1);
    const otherCopy = await db!.query<{public_slug:string; short_description:string}>(
      "select public_slug, short_description from workspace_services where workspace_id=$1 order by public_slug",
      [otherId],
    );
    expect(otherCopy.rows).toEqual([
      { public_slug: "maria-bridal-trial-2026", short_description: "Keep other tenant copy" },
      { public_slug: "maria-bridal-without-trial-2026", short_description: "Other copy" },
    ]);
    const otherAudits = await db!.query<{count:number}>(
      "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
      [otherId],
    );
    expect(otherAudits.rows[0]?.count).toBe(0);
  });

  it("fails closed on unexpected translation read errors rather than exposing editable defaults", async () => {
    const factory = runtime.makeSql;
    const logging = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      runtime.makeSql = () => (() =>
        Promise.reject(Object.assign(new Error("Synthetic transient read error"), {code: "08006"})));
      await expect(readMariaCardTranslations(workspaceId))
        .rejects.toThrow("Synthetic transient read error");
      expect(logging).toHaveBeenCalled();
    } finally {
      runtime.makeSql = factory;
      logging.mockRestore();
    }
  });

  it("keeps Production content changes locked behind the explicit environment and 0074 schema gate", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED", undefined);
    const form = new FormData();
    form.set("year", "2036");
    form.set("trial", "6900"); form.set("without", "5800");
    for(const field of [
      "trial_description", "without_description",
      "trial_description_en", "trial_description_ar",
      "without_description_en", "without_description_ar",
    ]) form.set(field, "Not written");
    await expect(saveMariaProductionYearAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?error=translation_setup");
    const result = await db!.query<{count:number}>(
      "select count(*)::int as count from workspace_services where workspace_id=$1 and public_slug in ('maria-bridal-trial-2036','maria-bridal-without-trial-2036')",
      [workspaceId],
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it("refuses Production content writes when 0074 translation table is missing even with the editor enabled", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED", "true");
    const beforeAudit = await db!.query(
      "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
      [workspaceId],
    );
    const table = "maria_service_card_translations";
    const backup = "maria_service_card_translations_production_schema_hidden";
    await db!.query(`alter table ${table} rename to ${backup}`);
    try {
      const form = new FormData();
      form.set("year", "2032");form.set("trial", "6900");form.set("without", "5800");
      for (const field of ["trial_description","without_description","trial_description_en",
        "trial_description_ar","without_description_en","without_description_ar"]) form.set(field,"Synthetic editor copy");
      await expect(saveMariaProductionYearAction(form))
        .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?error=translation_setup");
      const services = await db!.query(
        "select count(*)::int as count from workspace_services where workspace_id=$1 and public_slug in ('maria-bridal-trial-2032','maria-bridal-without-trial-2032')",
        [workspaceId],
      );
      expect(Number(services.rows[0]?.count)).toBe(0);
      const afterAudit = await db!.query(
        "select count(*)::int as count from admin_audit_logs where workspace_id=$1::uuid and action='maria.booking_year_content.updated'",
        [workspaceId],
      );
      expect(afterAudit.rows).toEqual(beforeAudit.rows);
    } finally {
      await db!.query(`alter table ${backup} rename to ${table}`);
    }
  });

  it("Production owner saves yearly SV/EN/AR prices without changing publication, schedules or bookings", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED", "true");
    // Compare complete appointment slots and the actual weekend schedule,
    // not only booking counts: price edits may never mutate calendar data.
    await db!.query(
      "insert into workspace_booking_hours(workspace_id,weekday,opens_at,closes_at,is_closed) values($1,5,'08:00','16:00',false) on conflict(workspace_id,weekday) do nothing",
      [workspaceId],
    );
    const bookingsBefore = await db!.query(
      "select id::text,customer_id::text,service_id::text,status,starts_at::text,ends_at::text from bookings where workspace_id=$1 order by id",
      [workspaceId],
    );
    const hoursBefore = await db!.query(
      "select weekday,opens_at::text,closes_at::text,is_closed from workspace_booking_hours where workspace_id=$1 order by weekday",
      [workspaceId],
    );
    const form = new FormData();
    form.set("year", "2036");
    form.set("trial", "6900.25"); form.set("without", "5800");
    form.set("trial_description", "Brudmakeup med prov 2036");
    form.set("without_description", "Brudmakeup utan prov 2036");
    form.set("trial_description_en", "Bridal 2036 with trial");
    form.set("trial_description_ar", "مكياج عام ٢٠٣٦ مع تجربة");
    form.set("without_description_en", "Bridal 2036 without trial");
    form.set("without_description_ar", "مكياج عام ٢٠٣٦ بدون تجربة");
    // Publication is NEVER accepted from this writer, even if malicious
    // FormData includes a Preview-only enabled checkbox.
    form.set("enabled", "on");
    await expect(saveMariaProductionYearAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2036&year=2036#priser");
    const rows = await db!.query<{
      name:string;public_slug:string;price_amount_minor:number|string;short_description:string;
      public_status:string;is_active:boolean;conversion_mode:string;
    }>(
      "select name,public_slug,price_amount_minor,short_description,public_status,is_active,conversion_mode from workspace_services where workspace_id=$1 and public_slug in ('maria-bridal-trial-2036','maria-bridal-without-trial-2036') order by public_slug",
      [workspaceId],
    );
    expect(rows.rowCount).toBe(2);
    expect(rows.rows.map(row=>row.public_status)).toEqual(["draft","draft"]);
    expect(rows.rows.map(row=>row.is_active)).toEqual([false,false]);
    expect(rows.rows.map(row=>row.conversion_mode)).toEqual(["quote","quote"]);
    expect(rows.rows.find(row=>row.public_slug==="maria-bridal-trial-2036")?.price_amount_minor).toEqual(expect.anything());
    expect(Number(rows.rows.find(row=>row.public_slug==="maria-bridal-trial-2036")?.price_amount_minor)).toBe(690025);
    const translated = await readMariaCardTranslations(workspaceId);
    expect(translated.get("maria-bridal-trial-2036")).toEqual({en:"Bridal 2036 with trial",ar:"مكياج عام ٢٠٣٦ مع تجربة"});
    expect(translated.get("maria-bridal-without-trial-2036")).toEqual({en:"Bridal 2036 without trial",ar:"مكياج عام ٢٠٣٦ بدون تجربة"});

    // An existing published service must remain published and active after
    // a subsequent content-only save; no reservation/calendar writes.
    await db!.query(
      "update workspace_services set public_status='published',is_active=true where workspace_id=$1 and public_slug='maria-bridal-trial-2036'",
      [workspaceId],
    );
    form.set("trial", "6999.75");
    await expect(saveMariaProductionYearAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=2036&year=2036#priser");
    const state = await db!.query<{public_status:string;is_active:boolean;price_amount_minor:number|string}>(
      "select public_status,is_active,price_amount_minor from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2036'",
      [workspaceId],
    );
    expect(state.rows[0]?.public_status).toBe("published");
    expect(state.rows[0]?.is_active).toBe(true);
    expect(Number(state.rows[0]?.price_amount_minor)).toBe(699975);
    const bookingsAfter = await db!.query(
      "select id::text,customer_id::text,service_id::text,status,starts_at::text,ends_at::text from bookings where workspace_id=$1 order by id",
      [workspaceId],
    );
    const hoursAfter = await db!.query(
      "select weekday,opens_at::text,closes_at::text,is_closed from workspace_booking_hours where workspace_id=$1 order by weekday",
      [workspaceId],
    );
    expect(bookingsAfter.rows).toEqual(bookingsBefore.rows);
    expect(hoursAfter.rows).toEqual(hoursBefore.rows);
  });

  it("Production writer refuses another tenant or staff even when the environment flag is on", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED", "true");
    const form = new FormData();
    form.set("year", "2026"); form.set("trial", "1"); form.set("without", "2");
    for(const field of [
      "trial_description","without_description",
      "trial_description_en","trial_description_ar",
      "without_description_en","without_description_ar",
    ])form.set(field, "Forbidden");
    runtime.workspaceSlug = "unrelated-tenant";
    await expect(saveMariaProductionYearAction(form)).rejects.toThrow(/^TEST_REDIRECT:\/dashboard$/);
    runtime.workspaceSlug = "makeup-by-maria";
    runtime.role = "staff";
    try {
      await expect(saveMariaProductionYearAction(form)).rejects.toThrow(/^TEST_REDIRECT:\/dashboard$/);
    } finally {
      runtime.role = "owner";
      runtime.workspaceSlug = "makeup-by-maria";
    }
  });

  it("reschedules one Maria QA booking with the workspace lock and rejects overlapping verification holds", async () => {
    const day = (await db!.query<{ day: string }>(
      "select to_char(current_date + (((5 - extract(dow from current_date)::int + 7) % 7) + 7), 'YYYY-MM-DD') as day",
    )).rows[0]!.day;
    const year = day.slice(0, 4);
    if (year !== "2026") {
      // Reschedule availability is tied to the selected wedding year. Clone
      // the synthetic published service when the next Friday is in a new year.
      await db!.query(
        `insert into workspace_services (
          workspace_id, name, public_slug, duration_minutes,
          buffer_before_minutes, buffer_after_minutes,
          minimum_notice_minutes, maximum_advance_days, is_active, public_status
        )
        select workspace_id, $2::text, $3::text, duration_minutes,
          buffer_before_minutes, buffer_after_minutes,
          minimum_notice_minutes, maximum_advance_days, is_active, 'published'
        from workspace_services
        where workspace_id=$1 and public_slug='maria-bridal-trial-2026' and public_status='published'`,
        [workspaceId, `Maria QA reschedule ${year}`, `maria-bridal-trial-${year}`],
      );
    }
    const service = await db!.query<{ id: string }>(
      "select id::text from workspace_services where workspace_id=$1 and public_slug=$2 and public_status='published'",
      [workspaceId, `maria-bridal-trial-${year}`],
    );
    expect(service.rowCount).toBe(1);
    await db!.query(
      "update bookings set service_id=$1::uuid,source='public_booking',starts_at=now()+interval '20 days', ends_at=now()+interval '20 days 3 hours' where id=$2::uuid",
      [service.rows[0]!.id, bookingId],
    );
    await db!.query(
      "insert into workspace_booking_hours (workspace_id,weekday,opens_at,closes_at,is_closed) values ($1,5,'06:00','10:00',false) on conflict (workspace_id,weekday) do update set opens_at='06:00',closes_at='10:00',is_closed=false",
      [workspaceId],
    );
    const changed = await rescheduleMariaDashboardBooking({
      bookingId, workspaceId, localStartsAt: day + "T06:00",
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) throw new Error(changed.error);
    expect(changed.result.changed).toBe(true);
    const persisted = await db!.query(
      "select (starts_at at time zone 'Europe/Stockholm')::text as starts_local from bookings where id=$1::uuid",
      [bookingId],
    );
    expect(String(persisted.rows[0]?.starts_local)).toContain(day + " 06:00:00");
    // Persist the notification before a provider request, so the owner can retry.
    const savedNotice=await db!.query<{metadata:Record<string,unknown>}>(
      "select metadata from customer_events where workspace_id=$1 and booking_id=$2::uuid and metadata->>'source'='maria_manager_dashboard_reschedule' order by created_at desc,id desc limit 1",
      [workspaceId,bookingId],
    );
    expect(savedNotice.rows[0]?.metadata).toMatchObject({
      source:"maria_manager_dashboard_reschedule",notice_customer:"pending",
      notice_owner:"skipped",language:"sv",
      previous_starts_at:expect.any(String),previous_ends_at:expect.any(String),
    });

    const hold = await db!.query<{id:string}>(
      "insert into public_booking_verifications (workspace_id,public_booking_slug,customer_name,customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at) values ($1::uuid,'makeup-by-maria','QA Hold','qa@example.invalid',$2::uuid,'Synthetic hold',($3::timestamp at time zone 'Europe/Stockholm'),($3::timestamp at time zone 'Europe/Stockholm') + interval '3 hours','synthetic-only',now()+interval '30 minutes') returning id::text",
      [workspaceId, service.rows[0]!.id, day + " 09:30"],
    );
    try {
      const conflicted = await rescheduleMariaDashboardBooking({
        bookingId, workspaceId, localStartsAt: day + "T09:30",
      });
      expect(conflicted).toMatchObject({ ok: false, error: "conflict" });
    } finally {
      // A synthetic hold must not leak into the following independent
      // schedule-saving regression and falsely reject otherwise valid hours.
      await db!.query("delete from public_booking_verifications where id=$1::uuid", [hold.rows[0]!.id]);
    }
  });

  it("cancels a Preview booking with a tab-padded approved email using real PostgreSQL", async () => {
    const paddedCustomerId=randomUUID();
    const paddedBookingId=randomUUID();
    await db!.query(
      "insert into customers (id,workspace_id,name,email,status,source) values ($1::uuid,$2,'Synthetic Preview QA',$3,'active','dashboard_manual')",
      [paddedCustomerId,workspaceId,"\tQA@example.invalid  \r"],
    );
    try {
      await db!.query(
        "insert into bookings (id,workspace_id,customer_id,title,service,status,source,starts_at,ends_at) values ($1::uuid,$2,$3::uuid,'Synthetic QA cancellation','Synthetic makeup','requested','dashboard_manual',now()+interval '28 days',now()+interval '28 days 3 hours')",
        [paddedBookingId,workspaceId,paddedCustomerId],
      );
      // This tests the actual cancellation predicate, not a detached SQL copy.
      // Never send real email while exercising isolated PostgreSQL.
      vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY","");
      vi.stubEnv("BREVO_API_KEY","");
      const token=createCustomerCalendarToken({workspaceId,customerId:paddedCustomerId});
      expect(await cancelCustomerCalendarBooking(token,paddedBookingId,"sv")).toEqual({ok:true});
      const state=await db!.query<{status:string}>(
        "select status from bookings where id=$1::uuid and workspace_id=$2",
        [paddedBookingId,workspaceId],
      );
      expect(state.rows[0]?.status).toBe("cancelled");
    } finally {
      await db!.query("delete from customer_events where booking_id=$1::uuid",[paddedBookingId]);
      await db!.query("delete from bookings where id=$1::uuid",[paddedBookingId]);
      await db!.query("delete from customers where id=$1::uuid",[paddedCustomerId]);
    }
  });

  it("saves open days while ignoring invalid hidden clock values for closed days", async () => {
    const saved = await db!.query<{duration_minutes:number;buffer_after_minutes:number}>(
      "select duration_minutes,buffer_after_minutes from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2026' limit 1",
      [workspaceId],
    );
    expect(saved.rows).toHaveLength(1);
    const duration = String(saved.rows[0]!.duration_minutes);
    const buffer = String(saved.rows[0]!.buffer_after_minutes);
    const form = new FormData();
    form.set("duration_minutes", duration);
    form.set("buffer_after_minutes", buffer);
    form.set("original_duration_minutes", duration);
    form.set("original_buffer_after_minutes", buffer);
    for (const day of [5, 6, 0]) {
      form.set("day_" + day + "_first", "06:00");
      form.set("day_" + day + "_last", day === 0 ? "10:00" : "08:00");
    }
    form.set("day_0_closed", "on");
    form.set("day_0_first", "invalid-hidden-time");
    form.set("day_0_last", "invalid-hidden-time");
    await expect(saveMariaScheduleAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?updated=schedule#tider");
    const results = await db!.query<{
      weekday: number; is_closed: boolean; opens_at: string | null;
    }>(
      "select weekday,is_closed,opens_at::text from workspace_booking_hours where workspace_id=$1 and weekday in (0,5,6) order by weekday",
      [workspaceId],
    );
    expect(results.rows).toHaveLength(3);
    expect(results.rows.find((x) => x.weekday === 0)?.is_closed).toBe(true);
    expect(results.rows.find((x) => x.weekday === 0)?.opens_at).toBeNull();
    expect(results.rows.find((x) => x.weekday === 5)?.is_closed).toBe(false);
  });

  it("refuses a stale hours-only form that would retain an oversized saved duration", async () => {
    const before = await db!.query(
      "select weekday,opens_at::text,closes_at::text,is_closed from workspace_booking_hours where workspace_id=$1 order by weekday",
      [workspaceId],
    );
    const form = new FormData();
    form.set("duration_minutes","60");
    form.set("buffer_after_minutes","0");
    form.set("original_duration_minutes","60");
    form.set("original_buffer_after_minutes","0");
    for (const weekday of [5,6,0]) {
      form.set(`day_${weekday}_first`,"06:00");
      form.set(`day_${weekday}_last`,"22:00");
    }
    // The form considers 22:00 + 60 minutes valid. Persisted packages still
    // require 180+ minutes and must veto the hours-only save under DB lock.
    await expect(saveMariaScheduleAction(form))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?error=schedule");
    const after = await db!.query(
      "select weekday,opens_at::text,closes_at::text,is_closed from workspace_booking_hours where workspace_id=$1 order by weekday",
      [workspaceId],
    );
    expect(after.rows).toEqual(before.rows);
  });

  it("preserves an active OTP hold when the manager changes opening hours", async () => {
    const service = (await db!.query<{id:string;duration_minutes:number;buffer_after_minutes:number}>(
      "select id::text,duration_minutes,buffer_after_minutes from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2026'",
      [workspaceId],
    )).rows[0]!;
    expect(service?.id).toBeTruthy();
    const day = (await db!.query<{day:string}>(
      "select to_char(current_date+14+((6-extract(dow from current_date)::int+7)%7),'YYYY-MM-DD') as day",
    )).rows[0]!.day;
    const startsAt = (await db!.query<{start:string}>(
      "select (($1::date + time '09:00') at time zone 'Europe/Stockholm')::text as start",[day],
    )).rows[0]!.start;
    const holdId=randomUUID();
    await db!.query(
      `insert into public_booking_verifications(id,workspace_id,public_booking_slug,customer_name,
       customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at)
       values($1::uuid,$2::uuid,'makeup-by-maria','QA','qa@example.invalid',$3::uuid,
       'QA hold',$4::timestamptz,$4::timestamptz+interval '3 hours','synthetic',now()+interval '30 minutes')`,
      [holdId,workspaceId,service.id,startsAt],
    );
    try {
      const form = new FormData();
      form.set("duration_minutes",String(service.duration_minutes));
      form.set("buffer_after_minutes",String(service.buffer_after_minutes ?? 0));
      form.set("original_duration_minutes",String(service.duration_minutes));
      form.set("original_buffer_after_minutes",String(service.buffer_after_minutes ?? 0));
      for (const weekday of [5,6,0]) {
        form.set(`day_${weekday}_first`,weekday===6?"10:00":"06:00");
        form.set(`day_${weekday}_last`,"18:00");
      }
      await expect(saveMariaScheduleAction(form))
        .rejects.toThrow("TEST_REDIRECT:/dashboard/maria?error=schedule");
      const remaining = await db!.query(
        "select id from public_booking_verifications where id=$1::uuid and consumed_at is null",[holdId],
      );
      expect(remaining.rowCount).toBe(1);
    } finally {
      await db!.query("delete from public_booking_verifications where id=$1::uuid",[holdId]);
    }
  });

  it("keeps Maria year and schedule writers unavailable in Production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const form = new FormData();
    form.set("year", "2026");
    await expect(saveMariaYearAction(form)).rejects.toThrow("TEST_REDIRECT:/dashboard");
    await expect(saveMariaScheduleAction(form)).rejects.toThrow("TEST_REDIRECT:/dashboard");
    vi.stubEnv("VERCEL_ENV", "preview");
  });


  it("preserves a finalized Maria service buffer for manual bookings and availability blocks", async () => {
    const future = new Date(Date.now() + 75 * 86_400_000);
    const start = new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 10));
    const end = new Date(start.getTime() + 180 * 60_000);
    const withinBufferEnd = new Date(end.getTime() + 15 * 60_000);
    const afterBuffer = new Date(end.getTime() + 30 * 60_000);
    const service = await db!.query<{ id: string }>(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,buffer_before_minutes,buffer_after_minutes,is_active,public_status) values($1,'Synthetic buffered Maria service',$2,180,0,30,true,'published') returning id::text",
      [workspaceId, "maria-buffer-qa-" + randomUUID().slice(0, 8)],
    );
    await db!.query(
      "insert into bookings(workspace_id,customer_id,service_id,title,service,status,source,starts_at,ends_at) values($1,$2::uuid,$3::uuid,'Synthetic buffered finalized appointment','Maria QA','confirmed','dashboard_manual',$4::timestamptz,$5::timestamptz)",
      [workspaceId, customerId, service.rows[0]!.id, start.toISOString(), end.toISOString()],
    );
    const overlappingInput = {
      customerId, title: "Should be blocked by service buffer", status: "confirmed" as const,
      startsAt: end.toISOString(), endsAt: withinBufferEnd.toISOString(),
      city: "Södertälje", service: "QA manual booking",
      serviceCategorySlug: "", serviceSlug: "", notes: "synthetic only",
    };

    // The optimistic preflight must include the finalized appointment's buffer.
    await expect(createDashboardBooking(overlappingInput)).rejects.toBeInstanceOf(BookingTimeConflictError);

    // A stale preflight must not bypass the buffer check under advisory lock 713.
    const originalFactory = runtime.makeSql;
    if (!originalFactory) throw new Error("Synthetic SQL client not initialized");
    let bypasses = 0;
    runtime.makeSql = () => {
      const base = originalFactory() as {
        (parts: TemplateStringsArray, ...values: unknown[]): unknown;
        transaction: (queries: Query[]) => Promise<QueryResponse[]>;
      };
      const tagged = (parts: TemplateStringsArray, ...values: unknown[]) => {
        const query = compileSql(parts, values);
        if (query.text.includes("from bookings b") && query.text.includes("occupied_service.buffer_after_minutes")) {
          bypasses += 1;
          return Promise.resolve([] as QueryResponse);
        }
        return base(parts, ...values);
      };
      return Object.assign(tagged, { transaction: base.transaction });
    };
    try {
      await expect(createDashboardBooking(overlappingInput)).rejects.toBeInstanceOf(BookingTimeConflictError);
      expect(bypasses).toBe(1);
    } finally {
      runtime.makeSql = originalFactory;
    }

    const localClock = (value: Date) => {
      const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(value);
      const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
      return part("year") + "-" + part("month") + "-" + part("day") + "T" + part("hour") + ":" + part("minute");
    };
    const localStart = localClock(end);
    const localEnd = localClock(withinBufferEnd);
    expect(localStart.slice(0, 10)).toBe(localEnd.slice(0, 10));
    await expect(createDashboardAvailabilityBlock({
      localStartsAt: localStart, localEndsAt: localEnd, reason: "Buffered QA block",
    })).rejects.toMatchObject({ code: "conflict" });

    const day = localStart.slice(0, 10);
    const weekday = new Date(day + "T12:00:00Z").getUTCDay();
    await expect(createDashboardRecurringAvailabilityBlocks({
      startDate: day, endDate: day,
      startTime: localStart.slice(11), endTime: localEnd.slice(11),
      weekdays: [weekday], reason: "Buffered recurring QA block",
    })).rejects.toMatchObject({ code: "conflict" });

    // The buffer boundary itself is available when no other booking overlaps.
    const permittedId = await createDashboardBooking({
      ...overlappingInput,
      title: "After buffered treatment",
      startsAt: afterBuffer.toISOString(),
      endsAt: new Date(afterBuffer.getTime() + 15 * 60_000).toISOString(),
    });
    expect(permittedId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("rejects finalized before-buffers and live hold buffers across all manager writers", async () => {
    // These attempted intervals touch only a buffer, never the booking/hold
    // itself. Removing either buffer from an overlap query must fail this test.
    const service = await db!.query<{ id: string }>(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,buffer_before_minutes,buffer_after_minutes,is_active,public_status) values($1,'Synthetic two-sided buffer service',$2,180,30,45,true,'published') returning id::text",
      [workspaceId, "maria-buffer-both-" + randomUUID().slice(0, 8)],
    );
    expect(service.rowCount).toBe(1);
    const serviceId = service.rows[0]!.id;
    const futureStart = (offsetDays: number) => {
      const future = new Date(Date.now() + offsetDays * 86_400_000);
      return new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 10));
    };
    const toLocal = (instant: Date) => {
      const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(instant);
      const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
      return part("year") + "-" + part("month") + "-" + part("day") + "T" + part("hour") + ":" + part("minute");
    };

    const assertRejectedForEveryManagerWriter = async (
      label: string, attemptedStart: Date, attemptedEnd: Date,
    ) => {
      await expect(createDashboardBooking({
        customerId, title: "Rejected " + label, status: "confirmed",
        startsAt: attemptedStart.toISOString(), endsAt: attemptedEnd.toISOString(),
        city: "Södertälje", service: "Synthetic Maria booking",
        serviceCategorySlug: "", serviceSlug: "", notes: "synthetic only",
      })).rejects.toBeInstanceOf(BookingTimeConflictError);

      const localStart = toLocal(attemptedStart);
      const localEnd = toLocal(attemptedEnd);
      expect(localStart.slice(0, 10)).toBe(localEnd.slice(0, 10));
      await expect(createDashboardAvailabilityBlock({
        localStartsAt: localStart, localEndsAt: localEnd,
        reason: "Rejected single " + label,
      })).rejects.toMatchObject({ code: "conflict" });

      const day = localStart.slice(0, 10);
      const weekday = new Date(day + "T12:00:00Z").getUTCDay();
      await expect(createDashboardRecurringAvailabilityBlocks({
        startDate: day, endDate: day,
        startTime: localStart.slice(11), endTime: localEnd.slice(11),
        weekdays: [weekday], reason: "Rejected recurring " + label,
      })).rejects.toMatchObject({ code: "conflict" });

      // A failed guard must not leave a persisted booking or availability block.
      const persisted = await db!.query<{ count: number }>(
        "select count(*)::int as count from bookings where workspace_id=$1 and starts_at=$2::timestamptz and ends_at=$3::timestamptz",
        [workspaceId, attemptedStart.toISOString(), attemptedEnd.toISOString()],
      );
      expect(Number(persisted.rows[0]?.count ?? -1)).toBe(0);
    };

    const finalizedStart = futureStart(125);
    const finalizedEnd = new Date(finalizedStart.getTime() + 180 * 60_000);
    await db!.query(
      "insert into bookings(workspace_id,customer_id,service_id,title,service,status,source,starts_at,ends_at) values($1,$2::uuid,$3::uuid,'Synthetic finalized before-buffer','Maria QA','confirmed','dashboard_manual',$4::timestamptz,$5::timestamptz)",
      [workspaceId, customerId, serviceId, finalizedStart.toISOString(), finalizedEnd.toISOString()],
    );
    const beforeStart = new Date(finalizedStart.getTime() - 15 * 60_000);
    // The candidate ends exactly where the appointment starts; only its
    // 30-minute before-buffer can block the three attempted manager writes.
    await assertRejectedForEveryManagerWriter("finalized before-buffer", beforeStart, finalizedStart);

    const holdStart = futureStart(145);
    const holdEnd = new Date(holdStart.getTime() + 180 * 60_000);
    const hold = await db!.query<{ id: string }>(
      "insert into public_booking_verifications(workspace_id,public_booking_slug,customer_name,customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at) values($1::uuid,'makeup-by-maria','Synthetic pending customer','qa@example.invalid',$2::uuid,'Synthetic buffered hold',$3::timestamptz,$4::timestamptz,'synthetic-only',now()+interval '30 minutes') returning id::text",
      [workspaceId, serviceId, holdStart.toISOString(), holdEnd.toISOString()],
    );
    expect(hold.rowCount).toBe(1);
    // The candidate ends at the pending verification's start; only the hold
    // service's 30-minute before-buffer protects this interval.
    const holdBeforeStart = new Date(holdStart.getTime() - 15 * 60_000);
    await assertRejectedForEveryManagerWriter("active hold before-buffer", holdBeforeStart, holdStart);

    // The candidate begins exactly where the pending verification ends; only
    // the hold service's 45-minute after-buffer protects this interval.
    const afterEnd = new Date(holdEnd.getTime() + 15 * 60_000);
    await assertRejectedForEveryManagerWriter("active hold after-buffer", holdEnd, afterEnd);
  });

  it("reports Maria manager booking conflict after a concurrent confirmation commits under lock 713", async () => {
    const future = new Date(Date.now() + 45 * 86_400_000);
    const start = new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 10));
    const end = new Date(start.getTime() + 180 * 60_000);
    const count = async () => Number((await db!.query<{ total: number }>(
      "select count(*)::int as total from bookings where workspace_id=$1 and starts_at < $3::timestamptz and ends_at > $2::timestamptz and status not in ('cancelled','no_show')",
      [workspaceId, start.toISOString(), end.toISOString()],
    )).rows[0]?.total ?? 0);
    expect(await count()).toBe(0);

    const holder = new Client({ connectionString });
    await holder.connect();
    let committed = false;
    let pending: Promise<{ ok: boolean; error?: unknown }> | undefined;
    try {
      await holder.query("BEGIN");
      await holder.query("select pg_advisory_xact_lock(hashtextextended($1::text,713))", [workspaceId]);
      await holder.query(
        `insert into bookings(workspace_id,customer_id,title,service,status,source,starts_at,ends_at)
         values($1,$2::uuid,'Synthetic concurrent confirmation','QA service','confirmed','dashboard_manual',$3::timestamptz,$4::timestamptz)`,
        [workspaceId, customerId, start.toISOString(), end.toISOString()],
      );
      // The preflight cannot see the holder's uncommitted booking. It must
      // wait for the advisory lock before the final overlap check.
      pending = createDashboardBooking({
        customerId, title: "Blocked concurrent manager booking", status: "confirmed",
        startsAt: start.toISOString(), endsAt: end.toISOString(), city: "Södertälje",
        service: "QA service", serviceCategorySlug: "", serviceSlug: "", notes: "synthetic-only",
      }).then(() => ({ ok: true }), (error: unknown) => ({ ok: false, error }));

      let waiting = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        const state = await db!.query<{ count: number }>(
          `select count(*)::int as count from pg_stat_activity
           where datname=current_database() and pid<>pg_backend_pid()
             and wait_event_type='Lock' and wait_event='advisory'`,
        );
        if (Number(state.rows[0]?.count ?? 0) > 0) {
          waiting = true;
          break;
        }
        await delay(100);
      }
      await holder.query("COMMIT");
      committed = true;
      const result = await pending;
      expect(waiting).toBe(true);
      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(BookingTimeConflictError);
      expect(await count()).toBe(1);
    } finally {
      if (!committed) await holder.query("ROLLBACK").catch(() => undefined);
      await holder.end();
      if (pending) await pending.catch(() => undefined);
    }
  }, 30_000);

});
