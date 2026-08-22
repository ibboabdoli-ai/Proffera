import { NextResponse } from "next/server";

import { runMarketplaceAutoDispatch } from "@/lib/marketplace-auto-dispatch-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, worker: "marketplace-auto-dispatch" });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMarketplaceAutoDispatch({ baseUrl: new URL(request.url).origin });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    console.error("Marketplace auto dispatch cron failed", error);
    return NextResponse.json({ ok: false, code: "worker_error" }, { status: 500 });
  }
}
