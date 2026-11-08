import "server-only";

import { Client } from "pg";

import { resolveNodePostgresDatabaseUrl } from "@/lib/db/database-url";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DISPATCH_MS = 18_000;
const IDLE_TRANSACTION_LIMIT_MS = 24_000;

/**
 * Coordinate Maria notifications with booking writers (advisory seed 713).
 *
 * Hold the transaction lock through the outbound provider request. Never turn
 * the server's idle-in-transaction protection OFF: a stalled unrelated DB
 * read must not block booking writers indefinitely. The shorter application
 * deadline aborts dispatch before PostgreSQL's safety timeout releases lock.
 *
 * Every callback must check its AbortSignal after async database reads and
 * forward it to outbound provider requests. Cancellation of an already
 * accepted HTTP request cannot guarantee inbox delivery order.
 */
export async function withMariaBookingNotificationLock<T>(
  workspaceId: string,
  action: (signal: AbortSignal) => Promise<T>,
  /** For isolated deadline tests only; callers cannot extend the limit. */
  requestedDeadlineMs = MAX_DISPATCH_MS,
): Promise<T> {
  const connectionString = resolveNodePostgresDatabaseUrl();
  if (!uuid.test(workspaceId) || !connectionString) {
    throw new Error("Maria notification lock unavailable");
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 4_000,
    query_timeout: 6_000,
  });
  const controller = new AbortController();
  client.on("error", () => controller.abort());
  client.on("end", () => controller.abort());

  let transactionOpen = false;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await client.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '5000ms'");
    await client.query("SET LOCAL statement_timeout = '6000ms'");
    await client.query(`SET LOCAL idle_in_transaction_session_timeout = '${IDLE_TRANSACTION_LIMIT_MS}ms'`);
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 713))",
      [workspaceId],
    );

    const deadlineMs = Math.max(100, Math.min(MAX_DISPATCH_MS, requestedDeadlineMs));
    const deadline = new Promise<never>((_resolve, reject) => {
      deadlineTimer = setTimeout(() => {
        controller.abort();
        reject(new Error("Maria notification deadline exceeded"));
      }, deadlineMs);
    });
    return await Promise.race([
      Promise.resolve().then(() => action(controller.signal)),
      deadline,
    ]);
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    // A late callback must never initiate a new email after the lock closes.
    controller.abort();
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}
