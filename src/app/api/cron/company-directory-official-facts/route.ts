import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { enrichCompanyDirectoryOfficialFacts } from "@/lib/company-directory-official-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bearerMatches(authorization: string | null, secret: string | undefined) {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function authorizedSchedulerRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  return bearerMatches(authorization, process.env.CRON_SECRET)
    || bearerMatches(authorization, process.env.PRODUCTION_SCHEDULER_SECRET);
}

export async function GET(request: Request) {
  if (!authorizedSchedulerRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.COMPANY_DIRECTORY_SYNC_ENABLED !== "true") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Company directory sync is disabled",
    });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "10");

  try {
    const result = await enrichCompanyDirectoryOfficialFacts(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Company directory official facts enrichment failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Official facts enrichment failed",
      },
      { status: 500 },
    );
  }
}
