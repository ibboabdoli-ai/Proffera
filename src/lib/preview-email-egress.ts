import {
  resolveBrevoApiKey,
  resolvePreviewEmailRecipient,
} from "@/lib/email-runtime-config";

const BREVO_TRANSACTIONAL_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

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

export function buildPreviewSafeBrevoRequestInit(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  env: NodeJS.ProcessEnv = process.env,
): RequestInit | undefined {
  if (env.VERCEL_ENV !== "preview" || requestUrl(input) !== BREVO_TRANSACTIONAL_EMAIL_URL) {
    return init;
  }

  const apiKey = resolveBrevoApiKey(env);
  const safeRecipient = resolvePreviewEmailRecipient(env);
  if (!apiKey || !safeRecipient) {
    throw new Error("Preview email blocked: dedicated Brevo key and safe recipient are required.");
  }

  const payload = parseBrevoPayload(init?.body);
  const headers = new Headers(init?.headers);
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
    headers,
    body: JSON.stringify(safePayload),
  };
}
