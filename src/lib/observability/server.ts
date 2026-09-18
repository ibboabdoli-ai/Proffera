import "server-only";

export const PROFFERA_REQUEST_ID_HEADER = "x-proffera-request-id";

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/u;

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

type ObservabilityLevel = "info" | "warn" | "error";

export type ObservabilityEvent = {
  event: string;
  level?: ObservabilityLevel;
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  errorName?: string | null;
  digest?: string | null;
  source?: string | null;
  routeGroup?: string | null;
};

function headerValue(headers: HeaderSource, name: string) {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0] ?? null;
  return typeof direct === "string" ? direct : null;
}

export function normalizeRequestId(value: unknown) {
  const candidate = String(value ?? "").trim();
  return REQUEST_ID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

export function requestIdFromHeaders(headers?: HeaderSource) {
  return normalizeRequestId(headerValue(headers, PROFFERA_REQUEST_ID_HEADER))
    ?? globalThis.crypto.randomUUID();
}

function safeToken(value: unknown, fallback?: string) {
  const candidate = String(value ?? "").trim();
  if (SAFE_TOKEN_PATTERN.test(candidate)) return candidate;
  return fallback;
}

export function safeObservabilityRoute(value: unknown) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return "unknown";
  try {
    const pathname = new URL(candidate, "https://proffera.invalid").pathname;
    return pathname.length <= 300 ? pathname : pathname.slice(0, 300);
  } catch {
    const pathOnly = candidate.split(/[?#]/u, 1)[0] ?? "unknown";
    return pathOnly.startsWith("/") ? pathOnly.slice(0, 300) : "unknown";
  }
}

function deploymentSha() {
  const candidate = String(process.env.VERCEL_GIT_COMMIT_SHA ?? "").trim().toLowerCase();
  return /^[0-9a-f]{40}$/u.test(candidate) ? candidate : undefined;
}

export function logObservabilityEvent(input: ObservabilityEvent) {
  const level = input.level ?? "info";
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event: safeToken(input.event, "unknown_event"),
    service: "proffera",
    environment: safeToken(process.env.VERCEL_ENV ?? process.env.NODE_ENV, "unknown"),
    deploymentSha: deploymentSha(),
    requestId: normalizeRequestId(input.requestId) ?? undefined,
    route: input.route ? safeObservabilityRoute(input.route) : undefined,
    method: safeToken(input.method)?.toUpperCase(),
    statusCode: Number.isInteger(input.statusCode) ? input.statusCode : undefined,
    errorName: safeToken(input.errorName),
    digest: safeToken(input.digest),
    source: safeToken(input.source),
    routeGroup: safeToken(input.routeGroup),
  };

  const serialized = JSON.stringify(payload);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

type RequestErrorRequest = {
  path?: string;
  method?: string;
  headers?: HeaderSource;
};

type RequestErrorContext = {
  routePath?: string;
  routeType?: string;
  routerKind?: string;
  renderSource?: string;
  revalidateReason?: string;
};

export function captureServerRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  logObservabilityEvent({
    event: "server_request_error",
    level: "error",
    requestId: requestIdFromHeaders(request.headers),
    // routePath is the framework route template. Do not fall back to the raw
    // request path because public tokenized URLs can contain private identifiers.
    route: context.routePath ?? "unknown",
    method: request.method ?? "UNKNOWN",
    errorName: typeof record.name === "string" ? record.name : "Error",
    digest: typeof record.digest === "string" ? record.digest : null,
    source: "next.onRequestError",
  });
}
