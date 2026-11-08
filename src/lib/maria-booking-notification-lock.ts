import "server-only";

import { Client } from "pg";

import { resolveNodePostgresDatabaseUrl } from "@/lib/db/database-url";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Coordinate Maria notifications with existing booking writers (workspace
 * advisory lock seed 713). The read-only transaction pins the lock through
 * transaction-pooling proxies during bounded outbound provider requests.
 * On lock timeout callers must preserve a durable failed/pending notice.
 */
export async function withMariaBookingNotificationLock<T>(
  workspaceId: string,
  action: () => Promise<T>,
): Promise<T> {
  const connectionString = resolveNodePostgresDatabaseUrl();
  if (!uuid.test(workspaceId) || !connectionString) {
    throw new Error("Maria notification lock unavailable");
  }
  const client = new Client({ connectionString, connectionTimeoutMillis: 4_000 });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '5000ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '15000ms'");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 713))",
      [workspaceId],
    );
    return await action();
  } finally {
    // The lock holder never modifies data on this connection.
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}
