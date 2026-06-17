import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

function getHandlers() {
  return toNextJsHandler(getAuth());
}

export async function GET(request: NextRequest) {
  const handlers = getHandlers();

  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const handlers = getHandlers();

  return handlers.POST(request);
}
