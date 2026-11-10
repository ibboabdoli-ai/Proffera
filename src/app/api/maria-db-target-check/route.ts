/**
 * TEMPORARY diagnostic, DISABLED BY DEFAULT. Do not deploy without approval.
 * Owner session + one-time high-entropy token + Production/host/project checks.
 * Exact destination is checked before opening the same DB URL the app uses.
 * No secrets or customer information may be returned or logged.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Client } from "pg";

import { resolveDatabaseUrl, resolveNodePostgresDatabaseUrl } from "@/lib/db/database-url";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";
import {
  EXPECTED_MARIA_TARGET,
  matchesMariaProductionDatabaseUrl,
  summarizeMariaProof,
  type MariaDatabaseProbe,
} from "@/lib/maria-db-target-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Surrogate-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'",
  "Referrer-Policy": "no-referrer",
};

function denied() {
  return new Response(null, { status: 404, headers: responseHeaders });
}

function tokenAccepted(candidate: string | null, expected: string | undefined) {
  if (!candidate || !expected || Buffer.byteLength(expected, "utf8") < 32
    || Buffer.byteLength(expected, "utf8") > 256
    || Buffer.byteLength(candidate, "utf8") > 256) return false;
  const presented = Buffer.from(candidate, "utf8");
  const configured = Buffer.from(expected, "utf8");
  return presented.length === configured.length && timingSafeEqual(presented, configured);
}

function proofFailed() {
  return NextResponse.json({ targetVerified: false }, { status: 409, headers: responseHeaders });
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "production"
    || process.env.PROFFERA_MARIA_DB_PROOF_ENABLED !== "true") return denied();
  if (new URL(request.url).origin !== "https://www.proffera.se") return denied();
  if (!tokenAccepted(request.headers.get("x-maria-db-proof"),
    process.env.PROFFERA_MARIA_DB_PROOF_TOKEN)) return denied();

  const access = await getUserWorkspaceAccess();
  if (!access.ok || access.workspaceSlug !== "makeup-by-maria" || access.role !== "owner") {
    return denied();
  }

  // Uses exactly the same precedence rules as getSql() in Production.
  const source = resolveDatabaseUrl();
  const destinationMatched = matchesMariaProductionDatabaseUrl(source);
  const hintsMatched = (!process.env.NEON_PROJECT_ID
      || process.env.NEON_PROJECT_ID === EXPECTED_MARIA_TARGET.neonProjectId)
    && (!process.env.VERCEL_PROJECT_ID
      || process.env.VERCEL_PROJECT_ID === EXPECTED_MARIA_TARGET.vercelProjectId);
  if (!destinationMatched || !hintsMatched) return proofFailed();

  const connectionString = resolveNodePostgresDatabaseUrl();
  if (!connectionString) return proofFailed();

  // All database access is read-only; errors are intentionally suppressed.
  // pg may attach credentials to connection errors, so never log exceptions.
  const client = new Client({
    connectionString,
    application_name: "maria-db-target-readonly-proof",
    connectionTimeoutMillis: 4000,
    query_timeout: 4000,
    statement_timeout: 4000,
  });
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '4s'");
    const result = await client.query<MariaDatabaseProbe>(`
      select current_database() as database_name,
        current_setting('transaction_read_only') = 'on' as transaction_read_only,
        (select count(*)::int from workspaces
          where slug = 'makeup-by-maria'
            and status in ('active', 'trial')
            and public_booking_slug = 'makeup-by-maria') as maria_workspace_count
    `);
    const row = result.rows[0];
    if (!row) return proofFailed();
    const proof = summarizeMariaProof(destinationMatched, row, hintsMatched);
    return NextResponse.json(proof, { status: proof.targetVerified ? 200 : 409,
      headers: responseHeaders });
  } catch {
    return NextResponse.json({ targetVerified: false },
      { status: 503, headers: responseHeaders });
  } finally {
    // Cleanup on the same client. Never write or change persistent data.
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}
