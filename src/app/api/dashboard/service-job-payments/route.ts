import { NextResponse } from "next/server";

import { createWorkspaceServiceJobPaymentLink } from "@/lib/workspace-service-job-payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return NextResponse.json({ error: "invalid_request" }, { status: 403 });
  const body = await request.json().catch(() => null) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  try {
    const url = await createWorkspaceServiceJobPaymentLink(jobId, requestUrl.origin);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "error";
    const status = code === "forbidden" || code === "locked" ? 403 : code === "already_paid" ? 409 : 400;
    return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
