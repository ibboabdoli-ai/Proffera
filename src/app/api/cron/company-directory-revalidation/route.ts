import { NextResponse } from "next/server";

import { COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION } from "@/lib/company-directory-category-confidence";
import { revalidateCompanyDirectoryCategoryPolicyBatch } from "@/lib/company-directory-category-policy-revalidation";
import { revalidateAllCompanyDirectoryBatch } from "@/lib/company-directory-full-revalidation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REVALIDATION_BATCH_SIZE = 10;
const DEADLINE_BUFFER_MS = 5_000;

function failedPolicyEvaluation(error: unknown) {
  return {
    policyVersion: COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION,
    skipped: true,
    reason: "worker_error",
    selected: 0,
    evaluated: 0,
    kept: 0,
    movedToReview: 0,
    deferred: 0,
    errors: 1,
    errorSummary: error instanceof Error ? error.message : "Category policy revalidation failed",
    remaining: null as number | null,
  };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const schedulerSecret = process.env.COMPANY_DIRECTORY_REVALIDATION_SCHEDULER_SECRET;
  const authorization = request.headers.get("authorization");
  const authorized = [cronSecret, schedulerSecret]
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => authorization === `Bearer ${secret}`);

  if (!authorized) {
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
  let policyEvaluation;
  try {
    policyEvaluation = await revalidateCompanyDirectoryCategoryPolicyBatch(
      REVALIDATION_BATCH_SIZE,
      { deadlineAt },
    );
  } catch (error) {
    console.error("Company directory category policy revalidation failed", error);
    policyEvaluation = failedPolicyEvaluation(error);
  }

  if (policyEvaluation.reason === "worker_error" || (typeof policyEvaluation.remaining === "number" && policyEvaluation.remaining > 0)) {
    console.error("Category policy sweep failure detected", {
      reason: policyEvaluation.reason,
      remaining: policyEvaluation.remaining,
      errors: policyEvaluation.errors,
      errorSummary: policyEvaluation.errorSummary,
    });
  }

  try {
    const result = await revalidateAllCompanyDirectoryBatch(
      REVALIDATION_BATCH_SIZE,
      { deadlineAt },
    );
    return NextResponse.json({ ok: true, ...result, policyEvaluation });
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
