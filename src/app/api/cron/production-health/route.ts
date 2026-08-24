import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { readProductionSchemaHealth } from "@/lib/production-schema-health";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

function authorizedSchedulerRequest(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorizedSchedulerRequest(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const schema = await readProductionSchemaHealth();
  const environment = process.env.VERCEL_ENV ?? "unknown";
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const productionEnvironment = environment === "production";
  const ok = productionEnvironment && schema.ok;

  return NextResponse.json(
    {
      ok,
      environment,
      commit,
      schema,
    },
    { status: ok ? 200 : 503 },
  );
}
