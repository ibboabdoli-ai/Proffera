import { webVitalRouteGroups } from "@/lib/web-vitals-route";

const METRIC_NAMES = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);
const ROUTE_GROUPS = new Set<string>(webVitalRouteGroups);
const MAX_BODY_LENGTH = 2_048;

function badRequest() {
  return Response.json({ error: "Invalid web vital payload" }, { status: 400 });
}

function noContent() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return new Response(null, { status: 403 });
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return badRequest();
  }

  if (!raw || raw.length > MAX_BODY_LENGTH) {
    return raw.length > MAX_BODY_LENGTH
      ? new Response(null, { status: 413 })
      : badRequest();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return badRequest();
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return badRequest();
  }

  const record = payload as Record<string, unknown>;
  const name = record.name;
  const value = record.value;
  const rating = record.rating;
  const routeGroup = record.routeGroup;

  if (
    typeof name !== "string"
    || !METRIC_NAMES.has(name)
    || typeof value !== "number"
    || !Number.isFinite(value)
    || value < 0
    || value > 600_000
    || typeof rating !== "string"
    || !RATINGS.has(rating)
    || typeof routeGroup !== "string"
    || !ROUTE_GROUPS.has(routeGroup)
  ) {
    return badRequest();
  }

  const navigationType = typeof record.navigationType === "string"
    && /^[a-z-]{1,40}$/.test(record.navigationType)
    ? record.navigationType
    : "unknown";

  if (process.env.VERCEL_ENV === "production") {
    console.log(JSON.stringify({
      level: "info",
      msg: "web_vital",
      metric: name,
      value: Math.round(value * 100) / 100,
      rating,
      routeGroup,
      navigationType,
    }));
  }

  return noContent();
}
