import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  makeSql: undefined as
    | (() => (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>)
    | undefined,
}));

const mocks = vi.hoisted(() => ({
  sendBookingReminderEmail: vi.fn(),
  sendBookingReminderSms: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgres://booking-reminder-integration.invalid/local",
}));
vi.mock("@/features/email/booking-reminder-email", () => ({
  sendBookingReminderEmail: mocks.sendBookingReminderEmail,
}));
vi.mock("@/features/sms/booking-reminder-sms", () => ({
  sendBookingReminderSms: mocks.sendBookingReminderSms,
}));
vi.mock("@/lib/customer-calendar", () => ({
  createCustomerCalendarToken: vi.fn(() => "postgres-integration-token"),
}));
vi.mock("@/lib/public-booking-policy", () => ({
  resolveBookingTimeZone: vi.fn((timeZone: string) => timeZone || "Europe/Stockholm"),
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => {
    if (!bridge.makeSql) throw new Error("PostgreSQL integration bridge is not initialized");
    return bridge.makeSql();
  }),
}));

import { processBookingReminders } from "@/lib/booking-reminders";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const migrationFiles = [
  "20260613_phase18_booking_crm.sql",
  "20260616_0002_proffera_workspace_schema.sql",
  "20260614_phase18_15_workspace_settings.sql",
  "20260729_0018_booking_reminders.sql",
  "20260801_0020_workspace_market_settings.sql",
] as const;

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

async function applyMigration(client: Client, file: string) {
  await client.query(readFileSync(join(process.cwd(), "db/migrations", file), "utf8"));
}

function compileSql(strings: TemplateStringsArray, values: unknown[]) {
  let text = "";
  const parameters: unknown[] = [];
  strings.forEach((part, index) => {
    text += part;
    if (index < values.length) {
      parameters.push(values[index]);
      text += `$${parameters.length}`;
    }
  });
  return { text, parameters };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

if (RUN_POSTGRES_INTEGRATION) {
  describe.sequential("booking reminder PostgreSQL delivery claim", () => {
    let containerName = "";
    let connectionString = "";
    let setupClient: Client | undefined;
    let observerClient: Client | undefined;
    const runtimeClients = new Set<Client>();
    let runtimeOrdinal = 0;
    let firstBookingId = "";
    let firstWorkspaceId = "";
    let secondBookingId = "";
    let secondWorkspaceId = "";

    const firstClaimInserted = deferred();
    const releaseFirstClaim = deferred();
    const overlapEvidence = {
      observed: false,
      firstBackendPid: 0,
      secondBackendPid: 0,
      blockingPids: [] as number[],
    };

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

    async function waitUntilBlocked(secondPid: number, firstPid: number) {
      if (!observerClient) throw new Error("PostgreSQL observer is not initialized");
      for (let attempt = 0; attempt < 250; attempt += 1) {
        const result = await observerClient.query<{ blocking_pids: number[] }>(
          "select pg_blocking_pids($1) as blocking_pids",
          [secondPid],
        );
        const blockingPids = (result.rows[0]?.blocking_pids ?? []).map(Number);
        if (blockingPids.includes(firstPid)) return blockingPids;
        await delay(20);
      }
      throw new Error("Concurrent booking reminder claim never blocked on the first PostgreSQL transaction");
    }

    beforeAll(async () => {
      containerName = `proffera-booking-reminder-${process.pid}-${Date.now()}`;
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
      if (!port) throw new Error(`Could not resolve PostgreSQL port from: ${portLine}`);
      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();

      setupClient = new Client({ connectionString });
      observerClient = new Client({ connectionString });
      await setupClient.connect();
      await observerClient.connect();

      await setupClient.query('create table "user" (id text primary key)');
      for (const file of migrationFiles) await applyMigration(setupClient, file);

      // The reminder worker reads this legacy policy flag before selecting due reminders.
      // Migration 0018 predates the flag, so keep the compatibility column isolated to
      // this disposable database instead of changing or copying the delivery-table DDL.
      await setupClient.query(`
        alter table workspace_booking_reminder_settings
        add column if not exists auto_complete_enabled boolean not null default false
      `);

      firstWorkspaceId = randomUUID();
      secondWorkspaceId = randomUUID();
      const firstCustomerId = randomUUID();
      const secondCustomerId = randomUUID();
      firstBookingId = randomUUID();
      secondBookingId = randomUUID();

      await setupClient.query(`
        insert into workspaces (id, slug, name, company_name, primary_city, status)
        values
          ($1, $2, 'First Reminder Workspace', 'First Reminder Workspace AB', 'Södertälje', 'active'),
          ($3, $4, 'Second Reminder Workspace', 'Second Reminder Workspace AB', 'Stockholm', 'active')
      `, [
        firstWorkspaceId,
        `booking-reminder-${firstWorkspaceId}`,
        secondWorkspaceId,
        `booking-reminder-${secondWorkspaceId}`,
      ]);

      await setupClient.query(`
        insert into workspace_settings (workspace_id, company_name, primary_city, time_zone)
        values
          ($1, 'First Reminder Workspace AB', 'Södertälje', 'Europe/Stockholm'),
          ($2, 'Second Reminder Workspace AB', 'Stockholm', 'Europe/Stockholm')
      `, [firstWorkspaceId, secondWorkspaceId]);

      await setupClient.query(`
        insert into workspace_booking_reminder_settings (
          workspace_id, is_enabled, hours_before, email_enabled, sms_enabled, auto_complete_enabled
        ) values
          ($1, true, 24, true, true, false),
          ($2, true, 24, true, true, false)
      `, [firstWorkspaceId, secondWorkspaceId]);

      await setupClient.query(`
        insert into customers (id, workspace_id, name, email, phone, status)
        values
          ($1, $2, 'First Customer', 'first@example.test', '+46700000001', 'active'),
          ($3, $4, 'Second Customer', 'second@example.test', '+46700000002', 'active')
      `, [firstCustomerId, firstWorkspaceId, secondCustomerId, secondWorkspaceId]);

      const clock = await setupClient.query<{ now: Date }>("select clock_timestamp() as now");
      const databaseNow = new Date(clock.rows[0]?.now ?? Date.now());
      const firstStartsAt = new Date(databaseNow.getTime() + (23 * 60 + 15) * 60_000);
      const secondStartsAt = new Date(databaseNow.getTime() + (23 * 60 + 45) * 60_000);
      const firstEndsAt = new Date(firstStartsAt.getTime() + 60 * 60_000);
      const secondEndsAt = new Date(secondStartsAt.getTime() + 60 * 60_000);

      await setupClient.query(`
        insert into bookings (
          id, workspace_id, customer_id, title, service, city, status,
          starts_at, ends_at, source
        ) values
          ($1, $2, $3, 'First reminder booking', 'Hemstädning', 'Södertälje', 'confirmed', $4, $5, 'manual'),
          ($6, $7, $8, 'Second reminder booking', 'Fönsterputs', 'Stockholm', 'confirmed', $9, $10, 'manual')
      `, [
        firstBookingId,
        firstWorkspaceId,
        firstCustomerId,
        firstStartsAt,
        firstEndsAt,
        secondBookingId,
        secondWorkspaceId,
        secondCustomerId,
        secondStartsAt,
        secondEndsAt,
      ]);

      bridge.makeSql = () => {
        const runtimeIndex = ++runtimeOrdinal;
        const client = new Client({ connectionString });
        runtimeClients.add(client);
        const connected = client.connect();

        return async (strings: TemplateStringsArray, ...values: unknown[]) => {
          await connected;
          const { text, parameters } = compileSql(strings, values);
          const normalized = text.replace(/\s+/gu, " ").trim().toLowerCase();
          const isTargetClaim = normalized.startsWith("insert into booking_reminder_deliveries")
            && String(values[1]) === firstBookingId
            && String(values[2]) === "email";

          if (isTargetClaim && runtimeIndex === 1) {
            await client.query("begin");
            try {
              const result = await client.query(text, parameters);
              overlapEvidence.firstBackendPid = client.processID;
              firstClaimInserted.resolve();
              await withTimeout(
                releaseFirstClaim.promise,
                10_000,
                "Second booking reminder claim did not reach the PostgreSQL lock boundary",
              );
              await client.query("commit");
              return result.rows as Record<string, unknown>[];
            } catch (error) {
              await client.query("rollback").catch(() => undefined);
              throw error;
            }
          }

          if (isTargetClaim && runtimeIndex === 2) {
            await withTimeout(
              firstClaimInserted.promise,
              10_000,
              "First booking reminder claim did not enter its PostgreSQL transaction",
            );
            overlapEvidence.secondBackendPid = client.processID;
            const pendingClaim = client.query(text, parameters);
            try {
              overlapEvidence.blockingPids = await waitUntilBlocked(
                client.processID,
                overlapEvidence.firstBackendPid,
              );
              overlapEvidence.observed = true;
              releaseFirstClaim.resolve();
              const result = await withTimeout(
                pendingClaim,
                10_000,
                "Second booking reminder claim stayed blocked after the first transaction committed",
              );
              return result.rows as Record<string, unknown>[];
            } catch (error) {
              releaseFirstClaim.resolve();
              await pendingClaim.catch(() => undefined);
              throw error;
            }
          }

          const result = await client.query(text, parameters);
          return result.rows as Record<string, unknown>[];
        };
      };

      mocks.sendBookingReminderEmail.mockResolvedValue({ ok: true, providerId: "email-provider-id" });
      mocks.sendBookingReminderSms.mockResolvedValue({ ok: true, providerId: "sms-provider-id" });
    }, 120_000);

    afterAll(async () => {
      bridge.makeSql = undefined;
      await Promise.all([...runtimeClients].map((client) => client.end().catch(() => undefined)));
      await observerClient?.end().catch(() => undefined);
      await setupClient?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm may already have removed a failed container.
        }
      }
    }, 30_000);

    it("uses the real PostgreSQL uniqueness boundary to suppress duplicate concurrent sends", async () => {
      if (!setupClient) throw new Error("PostgreSQL setup client is not initialized");

      const constraint = await setupClient.query<{ definition: string }>(`
        select pg_get_constraintdef(oid) as definition
        from pg_constraint
        where conname = 'booking_reminder_delivery_unique'
      `);
      expect(constraint.rows[0]?.definition).toContain(
        "UNIQUE (workspace_id, booking_id, channel, scheduled_for)",
      );

      const [first, second] = await withTimeout(
        Promise.all([processBookingReminders(), processBookingReminders()]),
        20_000,
        "Concurrent booking reminder runs did not finish",
      );

      expect(overlapEvidence.observed).toBe(true);
      expect(overlapEvidence.firstBackendPid).toBeGreaterThan(0);
      expect(overlapEvidence.secondBackendPid).toBeGreaterThan(0);
      expect(overlapEvidence.blockingPids).toContain(overlapEvidence.firstBackendPid);
      expect(overlapEvidence.secondBackendPid).not.toBe(overlapEvidence.firstBackendPid);

      expect(first.checked).toBe(2);
      expect(second.checked).toBe(2);
      expect(first.sent + second.sent).toBe(4);
      expect(first.skipped + second.skipped).toBe(4);
      expect(first.failed + second.failed).toBe(0);
      expect(first.autoCompleted + second.autoCompleted).toBe(0);

      expect(mocks.sendBookingReminderEmail).toHaveBeenCalledTimes(2);
      expect(mocks.sendBookingReminderSms).toHaveBeenCalledTimes(2);
      expect(mocks.sendBookingReminderEmail.mock.calls.map(([payload]) => payload.customerEmail).sort()).toEqual([
        "first@example.test",
        "second@example.test",
      ]);
      expect(mocks.sendBookingReminderSms.mock.calls.map(([payload]) => payload.customerPhone).sort()).toEqual([
        "+46700000001",
        "+46700000002",
      ]);

      const deliveries = await setupClient.query<{
        workspace_id: string;
        booking_id: string;
        channel: string;
        row_count: number;
        status: string;
      }>(`
        select workspace_id, booking_id::text, channel, count(*)::int as row_count, max(status) as status
        from booking_reminder_deliveries
        group by workspace_id, booking_id, channel
        order by workspace_id, booking_id, channel
      `);

      expect(deliveries.rows).toHaveLength(4);
      expect(deliveries.rows.every((row) => row.row_count === 1 && row.status === "sent")).toBe(true);
      expect(new Set(deliveries.rows.map((row) => `${row.workspace_id}|${row.booking_id}|${row.channel}`))).toEqual(
        new Set([
          `${firstWorkspaceId}|${firstBookingId}|email`,
          `${firstWorkspaceId}|${firstBookingId}|sms`,
          `${secondWorkspaceId}|${secondBookingId}|email`,
          `${secondWorkspaceId}|${secondBookingId}|sms`,
        ]),
      );

      const emailCallsBeforeRetry = mocks.sendBookingReminderEmail.mock.calls.length;
      const smsCallsBeforeRetry = mocks.sendBookingReminderSms.mock.calls.length;
      const retry = await processBookingReminders();

      expect(retry).toEqual({ checked: 2, sent: 0, skipped: 4, failed: 0, autoCompleted: 0 });
      expect(mocks.sendBookingReminderEmail).toHaveBeenCalledTimes(emailCallsBeforeRetry);
      expect(mocks.sendBookingReminderSms).toHaveBeenCalledTimes(smsCallsBeforeRetry);

      const deliveryCountAfterRetry = await setupClient.query<{ count: number }>(
        "select count(*)::int as count from booking_reminder_deliveries",
      );
      expect(deliveryCountAfterRetry.rows[0]?.count).toBe(4);
    }, 30_000);
  });
}
