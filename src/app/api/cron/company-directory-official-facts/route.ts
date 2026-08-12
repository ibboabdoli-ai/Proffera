import { NextResponse } from "next/server";

import { enrichCompanyDirectoryOfficialFacts } from "@/lib/company-directory-official-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "5");

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
