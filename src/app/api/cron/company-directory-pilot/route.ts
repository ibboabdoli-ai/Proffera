import { NextResponse } from "next/server";

import { processCompanyDirectoryDiscoveryQueue } from "@/lib/company-directory-discovery-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PILOT_BATCH_SIZE = 10;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.COMPANY_DIRECTORY_SYNC_ENABLED !== "true") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Company directory sync is disabled",
    });
  }

  if (process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() !== "automatic") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Automatic company directory discovery is disabled",
    });
  }

  if (process.env.COMPANY_DIRECTORY_AUTO_PUBLISH?.trim().toLowerCase() === "true") {
    return NextResponse.json(
      {
        ok: false,
        error: "Pilot processing requires automatic publishing to remain disabled",
      },
      { status: 409 },
    );
  }

  if (process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED === "true") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Regular company directory profile processing is already enabled",
    });
  }

  try {
    const result = await processCompanyDirectoryDiscoveryQueue(PILOT_BATCH_SIZE);
    return NextResponse.json({
      ok: true,
      mode: "manual_pilot",
      limit: PILOT_BATCH_SIZE,
      ...result,
    });
  } catch (error) {
    console.error("Company directory pilot failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Company directory pilot failed",
      },
      { status: 500 },
    );
  }
}
