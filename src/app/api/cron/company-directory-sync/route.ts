import { NextResponse } from "next/server";

import { syncCompanyDirectory } from "@/lib/company-directory-engine";

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

  if (!process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Company directory source is not configured",
    });
  }

  try {
    const result = await syncCompanyDirectory();
    return NextResponse.json({ ok: true, ...result });
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
