import { NextResponse } from "next/server";

import { enqueueCompanyDirectoryCandidates } from "@/lib/company-directory-discovery-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ORGANIZATION_NUMBERS = 500;

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

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    enabled: enabled(),
    mode: process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() || "seed",
  });
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

  if (!Array.isArray(payload.organizationNumbers) || payload.organizationNumbers.length > MAX_ORGANIZATION_NUMBERS) {
    return NextResponse.json({ ok: false, error: `organizationNumbers must contain at most ${MAX_ORGANIZATION_NUMBERS} values` }, { status: 400 });
  }

  try {
    const result = await enqueueCompanyDirectoryCandidates({
      provider: typeof payload.provider === "string" ? payload.provider : undefined,
      sourceUrl,
      fingerprint: typeof payload.fingerprint === "string" ? payload.fingerprint : "",
      organizationNumbers: payload.organizationNumbers.map((value) => String(value ?? "")),
      discoveredCount: Number(payload.discoveredCount) || 0,
      acceptedCount: Number(payload.acceptedCount) || 0,
      final: payload.final === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Company directory discovery ingest failed", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Company directory discovery ingest failed",
    }, { status: 500 });
  }
}
