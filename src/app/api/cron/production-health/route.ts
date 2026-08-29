import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { readProductionSchemaHealth } from "@/lib/production-schema-health";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

function bearerMatches(authorization: string | null, secret: string | undefined) {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function authorizedSchedulerRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  return bearerMatches(authorization, process.env.CRON_SECRET)
    || bearerMatches(authorization, process.env.PRODUCTION_SCHEDULER_SECRET);
}

export async function GET(request: Request) {
  if (!authorizedSchedulerRequest(request)) {
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
