import { NextResponse } from "next/server";

import { revalidatePublishedCompanyDirectoryBatch } from "@/lib/company-directory-published-revalidation";

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
  const limit = Number(url.searchParams.get("limit") || "2");

  try {
    const result = await revalidatePublishedCompanyDirectoryBatch(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Company directory published revalidation failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Published revalidation failed",
      },
      { status: 500 },
    );
  }
}
