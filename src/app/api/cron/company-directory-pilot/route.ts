import { NextResponse } from "next/server";

import { processNewCompanyDirectoryDiscoveryQueueCandidate } from "@/lib/company-directory-discovery-queue";
import { enrichCompanyDirectoryOfficialFactsForProfile } from "@/lib/company-directory-official-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function organizationNumber(value: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

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

  const targetOrganizationNumber = organizationNumber(
    new URL(request.url).searchParams.get("organization_number"),
  );
  if (targetOrganizationNumber.length !== 10) {
    return NextResponse.json(
      { ok: false, error: "A 10-digit organization_number is required" },
      { status: 400 },
    );
  }

  try {
    const result = await processNewCompanyDirectoryDiscoveryQueueCandidate(targetOrganizationNumber);
    if (result.claimed === 0) {
      return NextResponse.json({
        ok: true,
        mode: "targeted_manual_pilot",
        limit: 1,
        skipped: true,
        reason: "The organization is not an eligible new pending candidate",
        ...result,
      });
    }

    if (!result.profileId) {
      throw new Error("Targeted pilot did not create a company profile");
    }

    const officialFacts = await enrichCompanyDirectoryOfficialFactsForProfile(result.profileId);
    return NextResponse.json({
      ok: true,
      mode: "targeted_manual_pilot",
      limit: 1,
      ...result,
      officialFacts,
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
