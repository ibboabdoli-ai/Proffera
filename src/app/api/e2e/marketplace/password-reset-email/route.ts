import { NextResponse } from "next/server";

import { resolveBrevoApiKey, resolvePreviewEmailRecipient } from "@/lib/email-runtime-config";
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
  email?: string;
  subject?: string;
  body?: string;
  events?: Array<{ name?: string }>;
};

const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const RESET_PATH = "/aterstall-losenord";
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

function resetUrlFromBody(body: string) {
  let searchFrom = 0;
  while (searchFrom < body.length) {
    const pathIndex = body.indexOf(RESET_PATH, searchFrom);
    if (pathIndex < 0) return null;
    searchFrom = pathIndex + RESET_PATH.length;

    const originIndex = body.lastIndexOf("https://", pathIndex);
    if (originIndex < 0 || pathIndex - originIndex > 256) continue;

    const fragmentIndex = body.indexOf("#token=", pathIndex + RESET_PATH.length);
    if (fragmentIndex < 0 || fragmentIndex - pathIndex > 128) continue;

    let token = "";
    for (let index = fragmentIndex + "#token=".length; index < body.length && token.length <= 128; index += 1) {
      const char = body[index];
      if (!/[A-Za-z0-9_-]/u.test(char)) break;
      token += char;
    }
    if (!RESET_TOKEN_PATTERN.test(token)) continue;

    const rawUrl = `${body.slice(originIndex, fragmentIndex)}#token=${token}`.replaceAll("&amp;", "&");
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:" || parsed.pathname !== RESET_PATH) continue;
      if (new URLSearchParams(parsed.hash.replace(/^#/, "")).get("token") !== token) continue;
      return parsed.toString();
    } catch {
      continue;
    }
  }
  return null;
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
    if (index > 0) await delay(400);

    const content = await emailContent(uuid, apiKey);
    if (!content) continue;
    const subject = String(content.subject ?? item.subject ?? "").trim();
    if (!RESET_SUBJECTS.has(subject)) continue;

    const resetUrl = resetUrlFromBody(String(content.body ?? ""));
    if (!resetUrl) continue;

    const sinkRecipientMatched = String(content.email ?? item.email ?? "").trim().toLowerCase() === sink;
    const events = (content.events ?? []).map((event) => String(event.name ?? "")).filter(Boolean);
    const acceptedByProvider = events.some((event) => ["sent", "delivered", "opened", "click"].includes(event));

    return NextResponse.json({
      ok: true,
      found: true,
      uuid,
      messageId: String(item.messageId ?? ""),
      subject,
      resetUrl,
      sinkRecipientMatched,
      acceptedByProvider,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    ok: true,
    found: false,
    uuid: "",
    messageId: "",
    subject: "",
    resetUrl: "",
    sinkRecipientMatched: false,
    acceptedByProvider: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
