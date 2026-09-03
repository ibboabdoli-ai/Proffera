import {
  resolveBrevoApiKey,
  resolvePreviewEmailRecipient,
} from "@/lib/email-runtime-config";

const BREVO_API_ORIGIN = "https://api.brevo.com";
const BREVO_TRANSACTIONAL_EMAIL_URL = `${BREVO_API_ORIGIN}/v3/smtp/email`;
const BREVO_TRANSACTIONAL_EMAIL_LIST_PATH = "/v3/smtp/emails";
const MARKETPLACE_E2E_PREVIEW_BRANCH = "work/proffera-marketplace-browser-lifecycle-e2e";
const BREVO_EMAIL_DETAIL_PATH = /^\/v3\/smtp\/emails\/([A-Za-z0-9_-]{8,128})$/;
const BREVO_EMAIL_LIST_QUERY_KEYS = ["email", "startDate", "endDate", "sort"] as const;

type BrevoPayload = Record<string, unknown> & {
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
};

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init: RequestInit | undefined) {
  const method = init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET");
  return String(method || "GET").trim().toUpperCase();
}

function requestHeaders(input: RequestInfo | URL, init: RequestInit | undefined) {
  if (init?.headers !== undefined) return new Headers(init.headers);
  if (typeof Request !== "undefined" && input instanceof Request) return new Headers(input.headers);
  return new Headers();
}

function parseRequestUrl(input: RequestInfo | URL) {
  try {
    return new URL(requestUrl(input));
  } catch {
    return null;
  }
}

function parseBrevoPayload(body: BodyInit | null | undefined): BrevoPayload {
  if (typeof body !== "string") {
    throw new Error("Preview email blocked: Brevo request body must be JSON text.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("Preview email blocked: Brevo request body is not valid JSON.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Preview email blocked: Brevo request payload is invalid.");
  }

  return payload as BrevoPayload;
}

function isExactMarketplaceE2ePreview(env: NodeJS.ProcessEnv) {
  return env.VERCEL_GIT_COMMIT_REF === MARKETPLACE_E2E_PREVIEW_BRANCH;
}

function validListReaderUrl(url: URL) {
  if (url.pathname !== BREVO_TRANSACTIONAL_EMAIL_LIST_PATH) return false;
  const entries = [...url.searchParams.entries()];
  if (entries.length !== BREVO_EMAIL_LIST_QUERY_KEYS.length) return false;

  for (const key of BREVO_EMAIL_LIST_QUERY_KEYS) {
    if (url.searchParams.getAll(key).length !== 1) return false;
  }
  if (entries.some(([key]) => !(BREVO_EMAIL_LIST_QUERY_KEYS as readonly string[]).includes(key))) return false;

  const email = url.searchParams.get("email")?.trim() ?? "";
  const startDate = url.searchParams.get("startDate") ?? "";
  const endDate = url.searchParams.get("endDate") ?? "";
  const sort = url.searchParams.get("sort") ?? "";
  return email.length > 3
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
    && sort === "desc";
}

function validDetailReaderUrl(url: URL) {
  return !url.search && BREVO_EMAIL_DETAIL_PATH.test(url.pathname);
}

function buildPreviewBrevoReaderInit(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  env: NodeJS.ProcessEnv,
) {
  const apiKey = resolveBrevoApiKey(env);
  if (!apiKey) {
    throw new Error("Preview email blocked: dedicated Brevo key is required.");
  }
  const headers = requestHeaders(input, init);
  headers.set("api-key", apiKey);
  headers.set("Accept", "application/json");
  return {
    ...init,
    method: "GET",
    headers,
  } satisfies RequestInit;
}

export function buildPreviewSafeBrevoRequestInit(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  env: NodeJS.ProcessEnv = process.env,
): RequestInit | undefined {
  if (env.VERCEL_ENV !== "preview") {
    return init;
  }

  const url = parseRequestUrl(input);
  if (!url || url.origin !== BREVO_API_ORIGIN) {
    return init;
  }

  const method = requestMethod(input, init);
  if (url.toString() === BREVO_TRANSACTIONAL_EMAIL_URL) {
    if (method !== "POST") {
      throw new Error("Preview Brevo request blocked: method is not approved.");
    }

    const apiKey = resolveBrevoApiKey(env);
    const safeRecipient = resolvePreviewEmailRecipient(env);
    if (!apiKey || !safeRecipient) {
      throw new Error("Preview email blocked: dedicated Brevo key and safe recipient are required.");
    }

    const payload = parseBrevoPayload(init?.body);
    const headers = requestHeaders(input, init);
    headers.set("api-key", apiKey);
    headers.set("Content-Type", "application/json");

    const safePayload: BrevoPayload = {
      ...payload,
      to: [{ email: safeRecipient, name: "Proffera Preview" }],
    };
    delete safePayload.cc;
    delete safePayload.bcc;

    return {
      ...init,
      method: "POST",
      headers,
      body: JSON.stringify(safePayload),
    };
  }

  const approvedReaderPath = validListReaderUrl(url) || validDetailReaderUrl(url);
  if (approvedReaderPath) {
    if (!isExactMarketplaceE2ePreview(env)) {
      throw new Error("Preview Brevo request blocked: reader endpoint is limited to Marketplace E2E Preview.");
    }
    if (method !== "GET") {
      throw new Error("Preview Brevo request blocked: method is not approved.");
    }
    return buildPreviewBrevoReaderInit(input, init, env);
  }

  throw new Error("Preview Brevo request blocked: endpoint is not approved.");
}
