/**
 * TEMPORARY diagnostic, DISABLED BY DEFAULT. Do not deploy without approval.
 * Owner session + short-lived token + shared one-use claim + Production/host/project checks.
 * Exact destination is checked before opening the same DB URL the app uses.
 * Return only the proof boolean; suppress route and workspace-query error details.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { put } from "@vercel/blob";
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
const maxProofWindowMs = 10 * 60 * 1000;

function proofWindowOpen(expiresAt: string | undefined, now = Date.now()) {
  if (!expiresAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expiresAt)) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > now && expiry - now <= maxProofWindowMs;
}

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
    || process.env.PROFFERA_MARIA_DB_PROOF_ENABLED !== "true"
    || !proofWindowOpen(process.env.PROFFERA_MARIA_DB_PROOF_EXPIRES_AT)) return denied();
  if (new URL(request.url).origin !== "https://www.proffera.se") return denied();
  if (!tokenAccepted(request.headers.get("x-maria-db-proof"),
    process.env.PROFFERA_MARIA_DB_PROOF_TOKEN)) return denied();

  // Claim before any destination or membership checks. Blob's create-only write is shared across all Vercel
  // instances and deployments; a duplicate, timeout or store failure never
  // permits another probe. The pathname contains only a hash of the strong token.
  // This store already serves public assets, so the marker has fixed harmless
  // content and its URL is never returned. A stolen token can burn the attempt
  // without an Owner session, but cannot run the proof. Do not reuse the token.
  if (!process.env.BLOB_READ_WRITE_TOKEN) return denied();
  const tokenHash = createHash("sha256")
    .update(process.env.PROFFERA_MARIA_DB_PROOF_TOKEN!, "utf8").digest("hex");
  try {
    await put(`internal/maria-db-proof/v1/${tokenHash}.txt`, "consumed", {
      access: "public", addRandomSuffix: false, allowOverwrite: false,
      contentType: "text/plain",
    });
  } catch {
    // A duplicate and an uncertain store outcome both fail closed.
    return denied();
  }

  // Validate the destination BEFORE calling any DB-backed auth/session helper.
  // Even a wrong URL must never be used for membership lookup.
  // Uses exactly the same precedence rules as getSql() in Production.
  const source = resolveDatabaseUrl();
  const destinationMatched = matchesMariaProductionDatabaseUrl(source);
  const hintsMatched = (!process.env.NEON_PROJECT_ID
      || process.env.NEON_PROJECT_ID === EXPECTED_MARIA_TARGET.neonProjectId)
    && (!process.env.VERCEL_PROJECT_ID
      || process.env.VERCEL_PROJECT_ID === EXPECTED_MARIA_TARGET.vercelProjectId);
  if (!destinationMatched || !hintsMatched) return denied();

  // Only consult DB-backed session/membership after proving its destination.
  // Suppress DB error details that may include the connection URL.
  let access;
  try {
    access = await getUserWorkspaceAccess({ suppressErrors: true });
  } catch {
    return denied();
  }
  if (!access.ok || access.workspaceSlug !== "makeup-by-maria" || access.role !== "owner") {
    return denied();
  }

  const connectionString = resolveNodePostgresDatabaseUrl();
  if (!connectionString) return proofFailed();

  // The proof's database access is read-only; errors are intentionally suppressed.
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
