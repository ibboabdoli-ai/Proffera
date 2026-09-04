import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  brevoApiKey: vi.fn(),
  previewRecipient: vi.fn(),
  emailOrigin: vi.fn(),
  resolveEmailLink: vi.fn(),
  isRuntime: vi.fn(),
  customerEmail: vi.fn(),
  providerEmail: vi.fn(),
  uuid: vi.fn(),
  authorizedRunId: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/email-runtime-config", () => ({
  resolveBrevoApiKey: mocks.brevoApiKey,
  resolvePreviewEmailRecipient: mocks.previewRecipient,
}));
vi.mock("@/lib/preview-marketplace-email-link", () => ({
  previewMarketplaceEmailOrigin: mocks.emailOrigin,
  resolvePreviewMarketplaceEmailLink: mocks.resolveEmailLink,
}));
vi.mock("@/lib/preview-marketplace-e2e", () => ({
  isPreviewMarketplaceE2eRuntime: mocks.isRuntime,
  previewMarketplaceE2eCustomerEmail: mocks.customerEmail,
  previewMarketplaceE2eProviderEmail: mocks.providerEmail,
  previewMarketplaceE2eUuid: mocks.uuid,
  resolveAuthorizedPreviewMarketplaceE2eRunId: mocks.authorizedRunId,
}));

import { GET } from "@/app/api/e2e/marketplace/email/route";

const suiteRunId = "a".repeat(48);
const customerRunId = "b".repeat(48);
const sink = "preview-sink@example.com";
const reviewCreatedAt = "2026-09-03T12:00:00.000Z";

function emailRequest(kind: string, run = customerRunId) {
  const query = new URLSearchParams({ kind, run });
  return new Request(`https://preview.example.vercel.app/api/e2e/marketplace/email?${query.toString()}`);
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(headers).entries()) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isRuntime.mockReturnValue(true);
  mocks.authorizedRunId.mockResolvedValue(suiteRunId);
  mocks.customerEmail.mockImplementation((value: string) => (
    /^[a-f0-9]{32,64}$/u.test(String(value ?? ""))
      ? `marketplace-e2e-${value}@customer.example.invalid`
      : null
  ));
  mocks.providerEmail.mockReturnValue("offers@preview-provider.example.invalid");
  mocks.uuid.mockReturnValue("11111111-1111-4111-8111-111111111111");
  mocks.brevoApiKey.mockReturnValue("preview-key");
  mocks.previewRecipient.mockReturnValue(sink);
  mocks.emailOrigin.mockReturnValue("https://preview.example.vercel.app");
  mocks.resolveEmailLink.mockResolvedValue("https://preview.example.vercel.app/offert/svara/token");
  mocks.getSql.mockReturnValue(vi.fn(async () => [{
    review_invitation_created_at: reviewCreatedAt,
    delivery_event_reason: "Verified review invitation email sent",
  }]));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Preview Marketplace email reader route", () => {
  it("returns 404 before provider access when OIDC authorization is missing", async () => {
    mocks.authorizedRunId.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid kind and run inputs before provider access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const invalidKind = await GET(emailRequest("other"));
    expect(invalidKind.status).toBe(400);
    await expect(invalidKind.json()).resolves.toEqual({ ok: false, error: "kind" });

    const invalidRun = await GET(emailRequest("review", "bad"));
    expect(invalidRun.status).toBe(400);
    await expect(invalidRun.json()).resolves.toEqual({ ok: false, error: "run" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the dedicated Preview reader configuration is missing", async () => {
    mocks.brevoApiKey.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries one 429 response and then returns bounded pending diagnostics", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(jsonResponse({ count: 0, transactionalEmails: [] }))
      .mockResolvedValueOnce(jsonResponse({ events: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(body).toMatchObject({
      ok: true,
      found: false,
      kind: "review",
      diagnostics: {
        lookupMode: "recipient",
        providerMessageIdPresent: false,
        reviewDeliveryState: "sent",
        eventMessageIdCount: 0,
        candidateCount: 0,
      },
    });
  });

  it("uses delivered event message IDs when the review transaction list has not indexed the message", async () => {
    mocks.resolveEmailLink.mockResolvedValue("https://preview.example.vercel.app/review/marketplace/token");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const marker = `Preview E2E Rör ${suiteRunId.slice(0, 8)} AB`;
    const messageId = "<review-message@smtp-relay.mailin.fr>";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        count: 1,
        transactionalEmails: [{
          uuid: "older-sink-mail",
          email: sink,
          date: "2026-09-03T11:58:00.000Z",
          subject: "older Preview mail",
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        events: [{
          date: "2026-09-03T12:00:10.000Z",
          event: "delivered",
          messageId,
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        count: 1,
        transactionalEmails: [{
          uuid: "review-event-mail",
          email: sink,
          date: "2026-09-03T12:00:10.000Z",
          messageId,
          subject: "opaque-list-subject",
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        email: sink,
        subject: `Hur gick det? – ${marker}`,
        body: `Dela din upplevelse för ${marker}. https://preview.example.vercel.app/review/marketplace/token`,
        events: [{ name: "sent" }, { name: "delivered" }],
      }))
      .mockResolvedValueOnce(jsonResponse({ count: 0, transactionalEmails: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const eventUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(eventUrl.pathname).toBe("/v3/smtp/statistics/events");
    expect(eventUrl.searchParams.get("email")).toBe(sink);
    expect(eventUrl.searchParams.get("event")).toBe("delivered");
    const exactUrl = new URL(String(fetchMock.mock.calls[2]?.[0]));
    expect(exactUrl.searchParams.get("messageId")).toBe(messageId);
    expect(body).toMatchObject({
      ok: true,
      found: true,
      kind: "review",
      messageId,
      sinkRecipientMatched: true,
      originalRecipientObserved: false,
      acceptedByProvider: true,
      delivered: true,
      link: "https://preview.example.vercel.app/review/marketplace/token",
    });
    expect(info).toHaveBeenCalledWith(
      "Preview Marketplace E2E email provider match",
      expect.objectContaining({
        kind: "review",
        lookupMode: "recipient_then_event_message_id",
        providerMessageId: messageId,
        delivered: true,
      }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("preview-key");
  });

  it("stops after the first failed exact event-message lookup", async () => {
    const firstMessageId = "<first-review@smtp-relay.mailin.fr>";
    const secondMessageId = "<second-review@smtp-relay.mailin.fr>";
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        count: 1,
        transactionalEmails: [{
          uuid: "older-sink-mail",
          email: sink,
          date: "2026-09-03T11:58:00.000Z",
          subject: "older Preview mail",
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        events: [
          { date: "2026-09-03T12:00:10.000Z", event: "delivered", messageId: firstMessageId },
          { date: "2026-09-03T12:00:11.000Z", event: "delivered", messageId: secondMessageId },
        ],
      }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "provider" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain(encodeURIComponent(firstMessageId));
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes(encodeURIComponent(secondMessageId)))).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("falls back from a not-yet-indexed provider message ID to the safe sink recipient scan", async () => {
    const sql = vi.fn(async () => [{
      reference_id: "PF-E2E-1",
      created_at: "2026-09-03T12:00:00.000Z",
      guest_provider_message_id: "<message123@example.com>",
      customer_provider_message_id: null,
    }]);
    mocks.getSql.mockReturnValue(sql);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ count: 0, transactionalEmails: [] }))
      .mockResolvedValueOnce(jsonResponse({ count: 0, transactionalEmails: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("guest"));
    const body = await response.json() as { diagnostics?: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("messageId=%3Cmessage123%40example.com%3E");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(`email=${encodeURIComponent(sink)}`);
    expect(body.diagnostics).toMatchObject({
      lookupMode: "message_id_then_recipient",
      providerMessageIdPresent: true,
      reviewDeliveryState: null,
      candidateCount: 0,
    });
  });

  it("reports pending detail diagnostics without exposing provider credentials", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        count: 1,
        transactionalEmails: [{
          uuid: "mail-uuid-1",
          email: sink,
          date: reviewCreatedAt,
          subject: `Preview E2E Rör ${suiteRunId.slice(0, 8)} AB`,
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        email: sink,
        subject: "unrelated",
        body: "no matching marker here",
        events: [],
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));
    const body = await response.json() as { diagnostics?: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.diagnostics).toMatchObject({
      reviewDeliveryState: "sent",
      eventMessageIdCount: 0,
      candidateCount: 1,
      selectedCandidateCount: 1,
      detailCandidateCount: 1,
      markerMatchedCount: 0,
      controlledLinkMatchedCount: 0,
    });
    expect(info).toHaveBeenCalledWith(
      "Preview Marketplace E2E email lookup pending",
      expect.objectContaining({ kind: "review", providerMessageIdPresent: false, reviewDeliveryState: "sent" }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("preview-key");
  });

  it("surfaces a pending review delivery state before the delivery event is persisted", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      review_invitation_created_at: reviewCreatedAt,
      delivery_event_reason: "",
    }]));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ count: 0, transactionalEmails: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));
    const body = await response.json() as { diagnostics?: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.diagnostics).toMatchObject({ reviewDeliveryState: "pending" });
  });

  it("detects a review email from safe-sink content even when Brevo list subject metadata is not usable", async () => {
    mocks.resolveEmailLink.mockResolvedValue("https://preview.example.vercel.app/review/marketplace/token");
    const marker = `Preview E2E Rör ${suiteRunId.slice(0, 8)} AB`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        count: 1,
        transactionalEmails: [{
          uuid: "review-mail-uuid",
          email: sink,
          date: reviewCreatedAt,
          subject: "opaque-list-subject",
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        email: sink,
        subject: `Hur gick det? – ${marker}`,
        body: `Dela din upplevelse för ${marker}. https://preview.example.vercel.app/review/marketplace/token`,
        events: [{ name: "sent" }, { name: "delivered" }],
      }))
      .mockResolvedValueOnce(jsonResponse({ count: 0, transactionalEmails: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(body).toMatchObject({
      ok: true,
      found: true,
      kind: "review",
      sinkRecipientMatched: true,
      originalRecipientObserved: false,
      acceptedByProvider: true,
      delivered: true,
      link: "https://preview.example.vercel.app/review/marketplace/token",
    });
  });

  it("uses the previous and current UTC dates so a midnight rollover cannot hide a just-sent email", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-04T00:00:30.000Z"));
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      review_invitation_created_at: "2026-09-03T23:59:30.000Z",
      delivery_event_reason: "Verified review invitation email sent",
    }]));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ count: 0, transactionalEmails: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.searchParams.get("startDate")).toBe("2026-09-03");
    expect(calledUrl.searchParams.get("endDate")).toBe("2026-09-04");
  });
});
