import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { resolveBrevoApiKey, resolvePreviewEmailRecipient } from "@/lib/email-runtime-config";
import {
  isPreviewMarketplaceE2eRuntime,
  previewMarketplaceE2eCustomerEmail,
  previewMarketplaceE2eProviderEmail,
  previewMarketplaceE2eUuid,
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
  providerMessageId: string | null;
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

function boundedRetryDelayMs(response: Response) {
  const retryAfter = response.headers.get("retry-after")?.trim() ?? "";
  if (/^\d+$/.test(retryAfter)) {
    return Math.min(3_000, Math.max(250, Number(retryAfter) * 1_000));
  }
  const retryAt = Date.parse(retryAfter);
  if (Number.isFinite(retryAt)) {
    return Math.min(3_000, Math.max(250, retryAt - Date.now()));
  }
  return 1_000;
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
        await delay(boundedRetryDelayMs(response));
        continue;
      }
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
  return null;
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

async function listTransactionalEmailByMessageId(messageId: string, apiKey: string) {
  const url = new URL("https://api.brevo.com/v3/smtp/emails");
  url.searchParams.set("messageId", messageId);
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
      providerMessageId: null,
    };
  }

  const email = previewMarketplaceE2eCustomerEmail(customerRunId);
  const profileId = previewMarketplaceE2eUuid("provider", suiteRunId);
  const sql = getSql();
  if (!email || !profileId || !sql) return null;
  const rows = await sql`
    select
      request.reference_id,
      request.created_at::text,
      invitation.provider_message_id as guest_provider_message_id,
      customer_access.provider_message_id as customer_provider_message_id
    from quote_requests request
    left join marketplace_quote_invitations invitation
      on invitation.quote_request_id = request.id
     and invitation.profile_id = ${profileId}::uuid
    left join marketplace_quote_customer_access customer_access
      on customer_access.quote_request_id = request.id
    where lower(btrim(request.contact_email)) = ${email}
    order by request.created_at desc
    limit 1
  `;
  const value = String(rows[0]?.reference_id ?? "").trim();
  if (!value) return null;
  const createdAtMs = Date.parse(String(rows[0]?.created_at ?? ""));
  const providerMessageId = String(
    kind === "guest"
      ? rows[0]?.guest_provider_message_id ?? ""
      : rows[0]?.customer_provider_message_id ?? "",
  ).trim() || null;
  return {
    value,
    notBeforeMs: Number.isFinite(createdAtMs) ? createdAtMs - 60_000 : null,
    subjectMatch: kind === "customer",
    providerMessageId,
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

  let lookupMode = marker.providerMessageId ? "message_id" : "recipient";
  let sinkList = marker.providerMessageId
    ? await listTransactionalEmailByMessageId(marker.providerMessageId, apiKey)
    : await listTransactionalEmails(sink, apiKey);
  if (!sinkList) {
    return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
  }

  // Brevo can accept a transactional send before its message-id lookup is
  // visible in the reporting index. Fall back to one bounded scan of the safe
  // Preview sink only; never scan the synthetic original recipient for content.
  if (marker.providerMessageId && (sinkList.transactionalEmails ?? []).length === 0) {
    lookupMode = "message_id_then_recipient";
    sinkList = await listTransactionalEmails(sink, apiKey);
    if (!sinkList) {
      return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
    }
  }

  const candidates = sinkList.transactionalEmails ?? [];
  const recent = lookupMode === "message_id"
    ? candidates.slice(0, 1)
    : candidates.filter((item) => likelyMarkerCandidate(item, marker)).slice(0, 6);

  let detailCandidateCount = 0;
  let markerMatchedCount = 0;
  let controlledLinkMatchedCount = 0;
  for (const [index, item] of recent.entries()) {
    const uuid = String(item.uuid ?? "").trim();
    if (!uuid) continue;
    if (index > 0 && lookupMode === "message_id_then_recipient") await delay(650);
    detailCandidateCount += 1;
    const content = await emailContent(uuid, apiKey);
    if (!content) continue;
    const subject = String(content.subject ?? item.subject ?? "");
    const body = String(content.body ?? "");
    if (!subject.includes(marker.value) && !body.includes(marker.value)) continue;
    markerMatchedCount += 1;
    const link = controlledLink(body, kind);
    if (!link) continue;
    controlledLinkMatchedCount += 1;

    const originalList = await listTransactionalEmails(original, apiKey);
    if (!originalList) {
      return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
    }
    const originalRecipientObserved = Number(
      originalList.count ?? originalList.transactionalEmails?.length ?? 0,
    ) > 0;
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

  const diagnostics = {
    lookupMode,
    providerMessageIdPresent: Boolean(marker.providerMessageId),
    candidateCount: candidates.length,
    selectedCandidateCount: recent.length,
    detailCandidateCount,
    markerMatchedCount,
    controlledLinkMatchedCount,
  };
  console.info("Preview Marketplace E2E email lookup pending", { kind, ...diagnostics });

  return NextResponse.json({
    ok: true,
    found: false,
    kind,
    sinkRecipientMatched: false,
    originalRecipientObserved: null,
    diagnostics,
  });
}
