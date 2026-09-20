import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { checkPasswordResetRateLimit } from "@/lib/password-reset-rate-limit";

export const runtime = "nodejs";

function getHandlers() {
  return toNextJsHandler(getAuth());
}

export async function GET(request: NextRequest) {
  const handlers = getHandlers();

  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkPasswordResetRateLimit(request);
  if (!rateLimit.allowed) {
    return Response.json(
      { code: "TOO_MANY_REQUESTS", message: "Too many requests." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const handlers = getHandlers();
  return handlers.POST(request);
}
