import { NextResponse } from "next/server";

import { processCompanyDirectoryDiscoveryQueue } from "@/lib/company-directory-discovery-queue";
import { syncCompanyDirectory } from "@/lib/company-directory-engine";
import { resolveReadyCompanyDirectoryProfiles } from "@/lib/company-directory-ready-resolution";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const enabled = process.env.COMPANY_DIRECTORY_SYNC_ENABLED === "true";
  if (!enabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Company directory sync is disabled",
    });
  }

  const profileProcessingEnabled = process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED === "true";
  if (!profileProcessingEnabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Company directory profile processing is disabled",
    });
  }

  try {
    const mode = process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase();
    if (mode === "automatic") {
      const readyResolution = await resolveReadyCompanyDirectoryProfiles();
      const result = await processCompanyDirectoryDiscoveryQueue();
      return NextResponse.json({
        ok: true,
        mode: "automatic_queue",
        ...result,
        readyResolution,
      });
    }

    if (!process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim()) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Company directory source is not configured",
      });
    }

    const result = await syncCompanyDirectory();
    return NextResponse.json({ ok: true, mode: mode || "seed", ...result });
  } catch (error) {
    console.error("Company directory sync cron failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Company directory sync failed",
      },
      { status: 500 },
    );
  }
}
