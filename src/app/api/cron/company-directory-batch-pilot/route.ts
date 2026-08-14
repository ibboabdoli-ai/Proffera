import { NextResponse } from "next/server";

import { processNewCompanyDirectoryDiscoveryQueueBatch } from "@/lib/company-directory-discovery-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTROLLED_BATCH_SIZE = 5;

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
        error: "Controlled batch processing requires automatic publishing to remain disabled",
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
    const result = await processNewCompanyDirectoryDiscoveryQueueBatch(CONTROLLED_BATCH_SIZE);
    if (result.claimed === 0) {
      return NextResponse.json({
        ok: true,
        mode: "controlled_manual_batch_pilot",
        ...result,
        skipped: true,
        reason: "There are no eligible new pending candidates",
      });
    }

    if (result.errors > 0) {
      return NextResponse.json(
        { ok: false, mode: "controlled_manual_batch_pilot", ...result },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, mode: "controlled_manual_batch_pilot", ...result });
  } catch (error) {
    console.error("Company directory controlled batch pilot failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Company directory controlled batch pilot failed",
      },
      { status: 500 },
    );
  }
}
