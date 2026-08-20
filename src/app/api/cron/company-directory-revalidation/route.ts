import { NextResponse } from "next/server";

import { revalidateAllCompanyDirectoryBatch } from "@/lib/company-directory-full-revalidation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REVALIDATION_BATCH_SIZE = 10;
const DEADLINE_BUFFER_MS = 5_000;

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

  if (process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED !== "true") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Company directory profile processing is disabled",
    });
  }

  const deadlineAt = Date.now() + maxDuration * 1_000 - DEADLINE_BUFFER_MS;
  try {
    const result = await revalidateAllCompanyDirectoryBatch(
      REVALIDATION_BATCH_SIZE,
      { deadlineAt },
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Company directory dedicated revalidation failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Company directory revalidation failed",
      },
      { status: 500 },
    );
  }
}
