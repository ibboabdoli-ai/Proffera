import { NextResponse } from "next/server";

import { resolveBrevoApiKey, resolvePreviewEmailRecipient } from "@/lib/email-runtime-config";
import { resolveMarketplacePublicBaseUrl } from "@/lib/marketplace-public-base-url";
import {
  isPreviewMarketplaceE2eRuntime,
  resolveAuthorizedPreviewMarketplaceE2eRunId,
} from "@/lib/preview-marketplace-e2e";

export const dynamic = "force-dynamic";

type BrevoEmailListItem = {
  email?: string;
  messageId?: string;
  subject?: string;
  uuid?: string;
};

type BrevoEmailList = {
  transactionalEmails?: BrevoEmailListItem[];
};

type BrevoEmailContent = {
  body?: string;
  email?: string;
  subject?: string;
  events?: Array<{ name?: string }>;
};

const RESET_PATH = "/aterstall-losenord";
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const RESET_SUBJECTS = new Set([
  "Återställ ditt lösenord på Proffera",
  "Reset your Proffera password",
]);

function unavailable() {
  return new NextResponse(null, { status: 404 });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlAttribute(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'");
}

function normalizedResetTarget(rawCandidate: string, expectedOrigin: string) {
  try {
    const url = new URL(decodeHtmlAttribute(rawCandidate.trim()), expectedOrigin);
    const token = new URLSearchParams(url.hash.slice(1)).get("token")?.trim() ?? "";
    if (
      url.origin !== expectedOrigin
      || url.pathname !== RESET_PATH
      || !RESET_TOKEN_PATTERN.test(token)
    ) return "";

    const fragment = new URLSearchParams({ token }).toString();
    return `${url.pathname}${url.search}#${fragment}`;
  } catch {
    return "";
  }
}

function candidateEnd(body: string, start: number) {
  const limit = Math.min(body.length, start + 2_048);
  for (let index = start; index < limit; index += 1) {
    const char = body[index];
    if (char === '"' || char === "'" || char === "<" || char === ">" || /\s/u.test(char)) {
      return index;
    }
  }
  return limit;
}

function resetTargetFromBody(body: string) {
  const expectedOrigin = new URL(resolveMarketplacePublicBaseUrl()).origin;
  const absolutePrefix = `${expectedOrigin}${RESET_PATH}`;

  // Brevo may expose the transactional body as plain text, HTML, or a combined body.
  // Prefer the exact Preview origin when it appears as plain text so no foreign URL can escape.
  let absoluteIndex = body.indexOf(absolutePrefix);
  while (absoluteIndex >= 0) {
    const end = candidateEnd(body, absoluteIndex);
    const target = normalizedResetTarget(body.slice(absoluteIndex, end), expectedOrigin);
    if (target) return target;
    absoluteIndex = body.indexOf(absolutePrefix, absoluteIndex + absolutePrefix.length);
  }

  // HTML bodies carry the same absolute URL in href. Keep this parser bounded and require
  // the same trusted Preview origin + reset path + token format before returning anything.
  let cursor = 0;
  while (cursor < body.length) {
    const markerIndex = body.indexOf(RESET_PATH, cursor);
    if (markerIndex < 0) return "";

    const hrefIndex = body.lastIndexOf('href="', markerIndex);
    if (hrefIndex >= 0 && markerIndex - hrefIndex <= 512) {
      const valueStart = hrefIndex + 6;
      const valueEnd = body.indexOf('"', valueStart);
      if (valueEnd > markerIndex && valueEnd - valueStart <= 2_048) {
        const target = normalizedResetTarget(body.slice(valueStart, valueEnd), expectedOrigin);
        if (target) return target;
      }
    }

    cursor = markerIndex + RESET_PATH.length;
  }

  return "";
}

async function brevoJson<T>(url: URL, apiKey: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "api-key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (response.status === 429 && attempt === 0) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await delay(Math.min(3_000, Math.max(500, Number.isFinite(retryAfter) ? retryAfter * 1_000 : 1_000)));
        continue;
      }
      if (!response.ok) return null;
      return await response.json() as T;
    } catch {
      return null;
    }
  }
  return null;
}

async function listTransactionalEmails(email: string, apiKey: string) {
  const nowMs = Date.now();
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const yesterday = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = new URL("https://api.brevo.com/v3/smtp/emails");
  url.searchParams.set("email", email);
  url.searchParams.set("startDate", yesterday);
  url.searchParams.set("endDate", today);
  url.searchParams.set("sort", "desc");
  url.searchParams.set("limit", "20");
  return brevoJson<BrevoEmailList>(url, apiKey);
}

async function emailContent(uuid: string, apiKey: string) {
  const url = new URL(`https://api.brevo.com/v3/smtp/emails/${encodeURIComponent(uuid)}`);
  return brevoJson<BrevoEmailContent>(url, apiKey);
}

export async function GET(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  if (!await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers)) return unavailable();

  const apiKey = resolveBrevoApiKey();
  const sink = resolvePreviewEmailRecipient();
  if (!apiKey || !sink) return NextResponse.json({ ok: false, error: "configuration" }, { status: 503 });

  const sinkList = await listTransactionalEmails(sink, apiKey);
  if (!sinkList) return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });

  const candidates = (sinkList.transactionalEmails ?? []).slice(0, 10);
  for (const [index, item] of candidates.entries()) {
    const uuid = String(item.uuid ?? "").trim();
    if (!uuid) continue;
    const listedSubject = String(item.subject ?? "").trim();
    if (listedSubject && !RESET_SUBJECTS.has(listedSubject)) continue;
    if (index > 0) await delay(400);

    const content = await emailContent(uuid, apiKey);
    if (!content) continue;
    const subject = String(content.subject ?? item.subject ?? "").trim();
    if (!RESET_SUBJECTS.has(subject)) continue;

    const sinkRecipientMatched = String(content.email ?? item.email ?? "").trim().toLowerCase() === sink;
    const events = (content.events ?? []).map((event) => String(event.name ?? "")).filter(Boolean);
    const acceptedByProvider = events.some((event) => ["sent", "delivered", "opened", "click"].includes(event));
    const resetTarget = resetTargetFromBody(String(content.body ?? ""));

    return NextResponse.json({
      ok: true,
      found: true,
      uuid,
      messageId: String(item.messageId ?? ""),
      subject,
      sinkRecipientMatched,
      acceptedByProvider,
      resetTarget,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    ok: true,
    found: false,
    uuid: "",
    messageId: "",
    subject: "",
    sinkRecipientMatched: false,
    acceptedByProvider: false,
    resetTarget: "",
  }, { headers: { "Cache-Control": "no-store" } });
}
