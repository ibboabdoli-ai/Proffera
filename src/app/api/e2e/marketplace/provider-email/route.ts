import { NextResponse } from "next/server";

import { resolveBrevoApiKey, resolvePreviewEmailRecipient } from "@/lib/email-runtime-config";
import {
  isPreviewMarketplaceE2eRuntime,
  resolveAuthorizedPreviewMarketplaceE2eRunId,
} from "@/lib/preview-marketplace-e2e";

export const dynamic = "force-dynamic";

type BrevoEmailListItem = {
  date?: string;
  email?: string;
  messageId?: string;
  subject?: string;
  uuid?: string;
};

type BrevoEmailList = {
  count?: number;
  transactionalEmails?: BrevoEmailListItem[];
};

type BrevoEmailContent = {
  email?: string;
  subject?: string;
  body?: string;
  events?: Array<{ name?: string }>;
};

function unavailable() {
  return new NextResponse(null, { status: 404 });
}

function ownerEmail(runId: string) {
  return `provider-e2e-${runId}@owner.example.invalid`;
}

function providerName(runId: string) {
  return `Preview Provider ${runId.slice(0, 8)} AB`;
}

function verificationCodeAfterLabel(body: string, label: string) {
  const start = body.toLocaleLowerCase("sv-SE").indexOf(label.toLocaleLowerCase("sv-SE"));
  if (start < 0) return "";

  let inTag = false;
  let inEntity = false;
  let digits = "";
  const limit = Math.min(body.length, start + label.length + 512);

  for (let index = start + label.length; index < limit; index += 1) {
    const char = body[index];
    if (inTag) {
      if (char === ">") inTag = false;
      continue;
    }
    if (inEntity) {
      if (char === ";") inEntity = false;
      continue;
    }
    if (char === "<") {
      inTag = true;
      continue;
    }
    if (char === "&") {
      inEntity = true;
      continue;
    }
    if (char >= "0" && char <= "9") {
      digits += char;
      if (digits.length === 6) {
        const next = body[index + 1] ?? "";
        return next >= "0" && next <= "9" ? "" : digits;
      }
      continue;
    }
    if (digits) return "";
    if (char === ":" || char === "-" || /\s/u.test(char)) continue;
    return "";
  }

  return "";
}

function verificationCodeFromBody(body: string) {
  const plainTextMatch = body.match(/Din verifieringskod är:\s*(\d{6})/iu)?.[1];
  if (plainTextMatch) return plainTextMatch;
  return verificationCodeAfterLabel(body, "Verifieringskod");
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

export async function GET(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const runId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!runId) return unavailable();

  const apiKey = resolveBrevoApiKey();
  const sink = resolvePreviewEmailRecipient();
  if (!apiKey || !sink) return NextResponse.json({ ok: false, error: "configuration" }, { status: 503 });

  const marker = providerName(runId);
  const original = ownerEmail(runId);
  const sinkList = await listTransactionalEmails(sink, apiKey);
  if (!sinkList) return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });

  const candidates = (sinkList.transactionalEmails ?? []).slice(0, 8);
  for (const [index, item] of candidates.entries()) {
    const uuid = String(item.uuid ?? "").trim();
    if (!uuid) continue;
    if (index > 0) await delay(500);
    const content = await emailContent(uuid, apiKey);
    if (!content) continue;
    const subject = String(content.subject ?? item.subject ?? "");
    const body = String(content.body ?? "");
    if (!subject.includes(marker) && !body.includes(marker)) continue;
    const code = verificationCodeFromBody(body);
    if (!code) continue;

    const originalList = await listTransactionalEmails(original, apiKey);
    if (!originalList) return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
    const originalRecipientObserved = Number(
      originalList.count ?? originalList.transactionalEmails?.length ?? 0,
    ) > 0;
    const sinkRecipientMatched = String(content.email ?? item.email ?? "").trim().toLowerCase() === sink;
    const events = (content.events ?? []).map((event) => String(event.name ?? "")).filter(Boolean);
    const acceptedByProvider = events.some((event) => ["sent", "delivered", "opened", "click"].includes(event));

    return NextResponse.json({
      ok: true,
      found: true,
      code,
      subject,
      sinkRecipientMatched,
      originalRecipientObserved,
      acceptedByProvider,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    ok: true,
    found: false,
    sinkRecipientMatched: false,
    originalRecipientObserved: false,
    acceptedByProvider: false,
  }, { headers: { "Cache-Control": "no-store" } });
}