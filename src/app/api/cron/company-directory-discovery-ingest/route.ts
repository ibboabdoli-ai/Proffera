import { NextResponse } from "next/server";

import { enqueueCompanyDirectoryCandidates } from "@/lib/company-directory-discovery-queue";
import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ORGANIZATION_NUMBERS = 500;
const DISCOVERY_PROVIDER = "scb_hvd_bulk";
const SOURCE_PROBE_QUERY = "source_probe";

type DiscoveryCandidate = {
  organizationNumber: string;
  primarySniCode: string;
};

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function enabled() {
  return process.env.COMPANY_DIRECTORY_SYNC_ENABLED === "true"
    && process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() === "automatic";
}

function allowedOfficialSourceUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return "";
    if (host !== "bolagsverket.se" && !host.endsWith(".bolagsverket.se")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeOrganizationNumber(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 10 ? digits : "";
}

function normalizePrimarySniCode(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return /^\d{4,5}$/.test(digits) ? digits : "";
}

function normalizeCandidate(value: unknown): DiscoveryCandidate {
  const candidate: Record<string, unknown> = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { organizationNumber: value };
  return {
    organizationNumber: normalizeOrganizationNumber(candidate.organizationNumber),
    primarySniCode: normalizePrimarySniCode(candidate.primarySniCode),
  };
}

function isoTimestamp(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

async function getLatestCompletedDiscoverySnapshot() {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const rows = await sql`
    select source_url, completed_at
    from company_directory_source_snapshots
    where provider = ${DISCOVERY_PROVIDER}
      and status = 'completed'
      and completed_at is not null
    order by completed_at desc
    limit 1
  `;

  return rows[0] ?? null;
}

async function probeOfficialSourceChange() {
  const snapshot = await getLatestCompletedDiscoverySnapshot();
  if (!snapshot) {
    return {
      sourceChanged: true,
      reason: "no_completed_snapshot",
      latestCompletedAt: "",
      sourceModifiedAt: "",
    };
  }

  const sourceUrl = allowedOfficialSourceUrl(snapshot.source_url);
  if (!sourceUrl) throw new Error("Latest discovery snapshot has an invalid official source URL");

  const response = await fetch(sourceUrl, {
    method: "HEAD",
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Official discovery source HEAD returned HTTP ${response.status}`);
  }
  if (!allowedOfficialSourceUrl(response.url)) {
    throw new Error("Official discovery source HEAD redirected outside Bolagsverket");
  }

  const latestCompletedAt = isoTimestamp(snapshot.completed_at);
  if (!latestCompletedAt) {
    return {
      sourceChanged: true,
      reason: "invalid_snapshot_completion_time",
      latestCompletedAt: "",
      sourceModifiedAt: "",
    };
  }

  const sourceModifiedAt = isoTimestamp(response.headers.get("last-modified"));
  if (!sourceModifiedAt) {
    return {
      sourceChanged: false,
      reason: "source_last_modified_unavailable",
      latestCompletedAt,
      sourceModifiedAt: "",
    };
  }

  const sourceChanged = Date.parse(sourceModifiedAt) > Date.parse(latestCompletedAt);
  return {
    sourceChanged,
    reason: sourceChanged ? "source_newer_than_last_discovery" : "source_not_newer_than_last_discovery",
    latestCompletedAt,
    sourceModifiedAt,
  };
}

async function filterCandidatesNeedingVerification(candidates: DiscoveryCandidate[]) {
  const normalized = candidates.filter((candidate) => candidate.organizationNumber.length === 10);
  if (normalized.length === 0) return [];

  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const itemsJson = JSON.stringify(normalized.map((candidate) => ({
    organization_number: candidate.organizationNumber,
    primary_sni_code: candidate.primarySniCode,
  })));

  const rows = await sql`
    select item.organization_number, item.primary_sni_code
    from jsonb_to_recordset(${itemsJson}::jsonb)
      as item(organization_number text, primary_sni_code text)
    where not exists (
      select 1
      from company_directory_profiles profile
      where profile.country_code = 'SE'
        and regexp_replace(profile.organization_number, '[^0-9]', '', 'g') = item.organization_number
        and (
          item.primary_sni_code = ''
          or regexp_replace(coalesce(profile.primary_sni_code, ''), '[^0-9]', '', 'g') = item.primary_sni_code
        )
    )
  `;

  return rows.map((row) => ({
    organizationNumber: String(row.organization_number ?? ""),
    primarySniCode: String(row.primary_sni_code ?? ""),
  }));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const mode = process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() || "seed";
  const automaticEnabled = enabled();
  const sourceProbeRequested = new URL(request.url).searchParams.get(SOURCE_PROBE_QUERY) === "1";

  if (!sourceProbeRequested) {
    return NextResponse.json({
      ok: true,
      enabled: automaticEnabled,
      mode,
    });
  }

  if (!automaticEnabled) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      mode,
      sourceProbe: {
        sourceChanged: false,
        reason: "automatic_discovery_disabled",
        latestCompletedAt: "",
        sourceModifiedAt: "",
      },
    });
  }

  try {
    return NextResponse.json({
      ok: true,
      enabled: true,
      mode,
      sourceProbe: await probeOfficialSourceChange(),
    });
  } catch (error) {
    console.error("Company directory discovery source probe failed", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Company directory discovery source probe failed",
    }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!enabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Automatic company discovery is disabled",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid discovery payload" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const sourceUrl = allowedOfficialSourceUrl(payload.sourceUrl);
  if (!sourceUrl) {
    return NextResponse.json({ ok: false, error: "Only official Bolagsverket HTTPS source URLs are accepted" }, { status: 400 });
  }

  const rawCandidates = Array.isArray(payload.candidates)
    ? payload.candidates
    : Array.isArray(payload.organizationNumbers)
      ? payload.organizationNumbers.map((organizationNumber) => ({ organizationNumber, primarySniCode: "" }))
      : null;
  if (!rawCandidates || rawCandidates.length > MAX_ORGANIZATION_NUMBERS) {
    return NextResponse.json({ ok: false, error: `candidates must contain at most ${MAX_ORGANIZATION_NUMBERS} values` }, { status: 400 });
  }

  try {
    const candidates = rawCandidates.map(normalizeCandidate);
    const candidatesNeedingVerification = await filterCandidatesNeedingVerification(candidates);
    const result = await enqueueCompanyDirectoryCandidates({
      provider: typeof payload.provider === "string" ? payload.provider : undefined,
      sourceUrl,
      fingerprint: typeof payload.fingerprint === "string" ? payload.fingerprint : "",
      candidates: candidatesNeedingVerification,
      discoveredCount: Number(payload.discoveredCount) || 0,
      acceptedCount: Number(payload.acceptedCount) || 0,
      final: payload.final === true,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      received: candidates.length,
      queued: candidatesNeedingVerification.length,
    });
  } catch (error) {
    console.error("Company directory discovery ingest failed", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Company directory discovery ingest failed",
    }, { status: 500 });
  }
}
