import { logObservabilityEvent, requestIdFromHeaders } from "@/lib/observability/server";
import { webVitalRouteGroups } from "@/lib/web-vitals-route";

const ROUTE_GROUPS = new Set<string>(webVitalRouteGroups);
const MAX_BODY_LENGTH = 2_048;
const SAFE_ERROR_NAME = /^[A-Za-z0-9_.:-]{1,80}$/u;
const SAFE_DIGEST = /^[A-Za-z0-9_-]{1,128}$/u;

function badRequest() {
  return Response.json({ error: "Invalid client error payload" }, { status: 400 });
}

function sameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readBoundedBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return { raw: "", tooLarge: true };
  }

  if (!request.body) return { raw: "", tooLarge: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      total += value.byteLength;
      if (total > MAX_BODY_LENGTH) {
        await reader.cancel().catch(() => undefined);
        return { raw: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    raw: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    tooLarge: false,
  };
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return new Response(null, { status: 415 });
  }

  let raw = "";
  try {
    const body = await readBoundedBody(request);
    if (body.tooLarge) return new Response(null, { status: 413 });
    raw = body.raw;
  } catch {
    return badRequest();
  }

  if (!raw) return badRequest();

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return badRequest();
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return badRequest();
  const record = payload as Record<string, unknown>;

  const name = typeof record.name === "string" && SAFE_ERROR_NAME.test(record.name)
    ? record.name
    : "Error";
  const digest = typeof record.digest === "string" && SAFE_DIGEST.test(record.digest)
    ? record.digest
    : null;
  const routeGroup = typeof record.routeGroup === "string" && ROUTE_GROUPS.has(record.routeGroup)
    ? record.routeGroup
    : "other";

  logObservabilityEvent({
    event: "client_global_error",
    level: "error",
    requestId: requestIdFromHeaders(request.headers),
    method: "POST",
    route: "/api/observability/client-error",
    errorName: name,
    digest,
    source: "app.global-error",
    routeGroup,
  });

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
