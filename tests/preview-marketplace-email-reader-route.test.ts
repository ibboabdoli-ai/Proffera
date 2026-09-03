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
      .mockResolvedValueOnce(jsonResponse({ count: 0, transactionalEmails: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body).toMatchObject({
      ok: true,
      found: false,
      kind: "review",
      diagnostics: {
        lookupMode: "recipient",
        providerMessageIdPresent: false,
        candidateCount: 0,
      },
    });
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("messageId=%3Cmessage123%40example.com%3E");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(`email=${encodeURIComponent(sink)}`);
    expect(body.diagnostics).toMatchObject({
      lookupMode: "message_id_then_recipient",
      providerMessageIdPresent: true,
      candidateCount: 0,
    });
  });

  it("reports pending detail diagnostics without exposing provider credentials", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        count: 1,
        transactionalEmails: [{ uuid: "mail-uuid-1", email: sink, subject: "unrelated" }],
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
    expect(body.diagnostics).toMatchObject({
      candidateCount: 1,
      selectedCandidateCount: 1,
      detailCandidateCount: 1,
      markerMatchedCount: 0,
      controlledLinkMatchedCount: 0,
    });
    expect(info).toHaveBeenCalledWith(
      "Preview Marketplace E2E email lookup pending",
      expect.objectContaining({ kind: "review", providerMessageIdPresent: false }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("preview-key");
  });

  it("uses the previous and current UTC dates so a midnight rollover cannot hide a just-sent email", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-04T00:00:30.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ count: 0, transactionalEmails: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(emailRequest("review"));

    expect(response.status).toBe(200);
    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.searchParams.get("startDate")).toBe("2026-09-03");
    expect(calledUrl.searchParams.get("endDate")).toBe("2026-09-04");
  });
});
