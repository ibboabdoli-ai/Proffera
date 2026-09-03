import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { resolveBrevoApiKey, resolvePreviewEmailRecipient } from "@/lib/email-runtime-config";
import {
  isPreviewMarketplaceE2eRuntime,
  previewMarketplaceE2eCustomerEmail,
  previewMarketplaceE2eProviderEmail,
  resolvePreviewMarketplaceE2eRunId,
} from "@/lib/preview-marketplace-e2e";

export const dynamic = "force-dynamic";

type EmailKind = "guest" | "customer" | "review";

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
  date?: string;
  email?: string;
  subject?: string;
  body?: string;
  events?: Array<{ name?: string; time?: string }>;
};

type EmailMarker = {
  value: string;
  notBeforeMs: number | null;
  subjectMatch: boolean;
};

const pathByKind: Record<EmailKind, string> = {
  guest: "/offert/svara/",
  customer: "/offert/jamfor/",
  review: "/review/marketplace/",
};

function unavailable() {
  return new NextResponse(null, { status: 404 });
}

function emailKind(value: string | null): EmailKind | null {
  return value === "guest" || value === "customer" || value === "review" ? value : null;
}

function previewOrigin() {
  const host = process.env.VERCEL_URL?.trim().toLowerCase();
  if (!host || !/^[a-z0-9.-]+\.vercel\.app$/.test(host)) return null;
  return `https://${host}`;
}

async function brevoJson<T>(url: URL, apiKey: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "api-key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Preview Marketplace E2E Brevo reader request failed", {
        path: url.pathname,
        status: response.status,
      });
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    console.error("Preview Marketplace E2E Brevo reader request failed", {
      path: url.pathname,
      error,
    });
    return null;
  }
}

async function listTransactionalEmails(email: string, apiKey: string) {
  const today = new Date().toISOString().slice(0, 10);
  const url = new URL("https://api.brevo.com/v3/smtp/emails");
  url.searchParams.set("email", email);
  url.searchParams.set("startDate", today);
  url.searchParams.set("endDate", today);
  url.searchParams.set("sort", "desc");
  url.searchParams.set("limit", "20");
  return brevoJson<BrevoEmailList>(url, apiKey);
}

async function emailContent(uuid: string, apiKey: string) {
  const url = new URL(`https://api.brevo.com/v3/smtp/emails/${encodeURIComponent(uuid)}`);
  return brevoJson<BrevoEmailContent>(url, apiKey);
}

function decodeHtmlUrl(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function controlledLink(body: string, kind: EmailKind) {
  const origin = previewOrigin();
  if (!origin) return null;
  const candidates = body.match(/https:\/\/[^\s"'<>]+/gu) ?? [];
  for (const candidate of candidates) {
    try {
      const url = new URL(decodeHtmlUrl(candidate));
      if (url.origin !== origin) continue;
      if (!url.pathname.startsWith(pathByKind[kind])) continue;
      return url.toString();
    } catch {
      // Ignore malformed URLs in provider-rendered email HTML.
    }
  }
  return null;
}

async function markerFor(kind: EmailKind, suiteRunId: string, customerRunId: string): Promise<EmailMarker | null> {
  if (kind === "review") {
    return {
      value: `Preview E2E Rör ${suiteRunId.slice(0, 8)} AB`,
      notBeforeMs: null,
      subjectMatch: true,
    };
  }

  const email = previewMarketplaceE2eCustomerEmail(customerRunId);
  const sql = getSql();
  if (!email || !sql) return null;
  const rows = await sql`
    select reference_id, created_at::text
    from quote_requests
    where lower(btrim(contact_email)) = ${email}
    order by created_at desc
    limit 1
  `;
  const value = String(rows[0]?.reference_id ?? "").trim();
  if (!value) return null;
  const createdAtMs = Date.parse(String(rows[0]?.created_at ?? ""));
  return {
    value,
    notBeforeMs: Number.isFinite(createdAtMs) ? createdAtMs - 60_000 : null,
    subjectMatch: kind === "customer",
  };
}

function originalRecipient(kind: EmailKind, suiteRunId: string, customerRunId: string) {
  if (kind === "guest") return previewMarketplaceE2eProviderEmail(suiteRunId);
  return previewMarketplaceE2eCustomerEmail(customerRunId);
}

function likelyMarkerCandidate(item: BrevoEmailListItem, marker: EmailMarker) {
  const subject = String(item.subject ?? "");
  if (marker.subjectMatch) return subject.includes(marker.value);
  if (marker.notBeforeMs === null) return true;
  const itemTime = Date.parse(String(item.date ?? ""));
  return Number.isFinite(itemTime) && itemTime >= marker.notBeforeMs;
}

export async function GET(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const suiteRunId = resolvePreviewMarketplaceE2eRunId(request.headers);
  if (!suiteRunId) return unavailable();

  const url = new URL(request.url);
  const kind = emailKind(url.searchParams.get("kind"));
  const customerRunId = String(url.searchParams.get("run") ?? "").trim().toLowerCase();
  if (!kind) return NextResponse.json({ ok: false, error: "kind" }, { status: 400 });
  if (!customerRunId || !previewMarketplaceE2eCustomerEmail(customerRunId)) {
    return NextResponse.json({ ok: false, error: "run" }, { status: 400 });
  }

  const apiKey = resolveBrevoApiKey();
  const sink = resolvePreviewEmailRecipient();
  const marker = await markerFor(kind, suiteRunId, customerRunId);
  const original = originalRecipient(kind, suiteRunId, customerRunId);
  if (!apiKey || !sink || !marker || !original || !previewOrigin()) {
    return NextResponse.json({ ok: false, error: "configuration" }, { status: 503 });
  }

  const [sinkList, originalList] = await Promise.all([
    listTransactionalEmails(sink, apiKey),
    listTransactionalEmails(original, apiKey),
  ]);
  if (!sinkList || !originalList) {
    return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
  }

  const originalRecipientObserved = Number(originalList.count ?? originalList.transactionalEmails?.length ?? 0) > 0;
  const recent = (sinkList.transactionalEmails ?? [])
    .filter((item) => likelyMarkerCandidate(item, marker))
    .slice(0, kind === "guest" ? 6 : 3);
  for (const item of recent) {
    const uuid = String(item.uuid ?? "").trim();
    if (!uuid) continue;
    const content = await emailContent(uuid, apiKey);
    if (!content) continue;
    const subject = String(content.subject ?? item.subject ?? "");
    const body = String(content.body ?? "");
    if (!subject.includes(marker.value) && !body.includes(marker.value)) continue;
    const link = controlledLink(body, kind);
    if (!link) continue;
    const sinkRecipientMatched = String(content.email ?? item.email ?? "").trim().toLowerCase() === sink;
    const events = (content.events ?? []).map((event) => String(event.name ?? "")).filter(Boolean);
    return NextResponse.json({
      ok: true,
      found: true,
      kind,
      link,
      messageId: String(item.messageId ?? ""),
      subject,
      sinkRecipientMatched,
      originalRecipientObserved,
      acceptedByProvider: events.some((event) => ["sent", "delivered", "opened", "click"].includes(event)),
      delivered: events.includes("delivered") || events.includes("opened") || events.includes("click"),
    });
  }

  return NextResponse.json({
    ok: true,
    found: false,
    kind,
    sinkRecipientMatched: false,
    originalRecipientObserved,
  });
}
