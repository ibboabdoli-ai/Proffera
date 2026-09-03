import { describe, expect, it, vi } from "vitest";

import {
  isApprovedBrevoTrackingHost,
  previewMarketplaceEmailLinkCandidates,
  previewMarketplaceEmailOrigin,
  resolvePreviewMarketplaceEmailLink,
} from "@/lib/preview-marketplace-email-link";

const PREVIEW_ORIGIN = "https://proffera-jhap-safe-preview.vercel.app";

describe("Preview Marketplace email link resolution", () => {
  it("accepts only HTTPS Vercel Preview origins", () => {
    expect(previewMarketplaceEmailOrigin(`${PREVIEW_ORIGIN}/api/e2e/marketplace/email`)).toBe(PREVIEW_ORIGIN);
    expect(previewMarketplaceEmailOrigin("http://proffera-jhap-safe-preview.vercel.app/test")).toBeNull();
    expect(previewMarketplaceEmailOrigin("https://www.proffera.se/test")).toBeNull();
    expect(previewMarketplaceEmailOrigin("https://example.com/test")).toBeNull();
  });

  it("recognizes only Brevo-owned or Proffera branded tracking hosts", () => {
    expect(isApprovedBrevoTrackingHost("r.brevolinks.com")).toBe(true);
    expect(isApprovedBrevoTrackingHost("click.sendibm2.com")).toBe(true);
    expect(isApprovedBrevoTrackingHost("r.mail.proffera.se")).toBe(true);
    expect(isApprovedBrevoTrackingHost("www.proffera.se")).toBe(false);
    expect(isApprovedBrevoTrackingHost("evil.example.com")).toBe(false);
    expect(isApprovedBrevoTrackingHost("proffera-jhap-safe-preview.vercel.app")).toBe(false);
  });

  it("deduplicates and bounds provider-rendered HTTPS candidates", () => {
    const body = Array.from({ length: 20 }, (_, index) => `https://r.brevolinks.com/${index}`).join(" ")
      + " https://r.brevolinks.com/0 http://r.brevolinks.com/insecure";
    const candidates = previewMarketplaceEmailLinkCandidates(body);
    expect(candidates).toHaveLength(16);
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates.every((candidate) => candidate.startsWith("https://"))).toBe(true);
  });

  it("returns a direct exact-origin lifecycle link without outbound resolution", async () => {
    const fetchImpl = vi.fn();
    const link = `${PREVIEW_ORIGIN}/offert/svara/synthetic-token`;
    await expect(resolvePreviewMarketplaceEmailLink({
      body: `<a href="${link}">open</a>`,
      kind: "guest",
      origin: PREVIEW_ORIGIN,
      fetchImpl,
    })).resolves.toBe(link);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolves one Brevo tracking redirect only to the exact Preview origin and expected path", async () => {
    const destination = `${PREVIEW_ORIGIN}/offert/svara/synthetic-token`;
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      return new Response(null, { status: 302, headers: { location: destination } });
    });

    await expect(resolvePreviewMarketplaceEmailLink({
      body: '<a href="https://r.brevolinks.com/click-id">open</a>',
      kind: "guest",
      origin: PREVIEW_ORIGIN,
      fetchImpl,
    })).resolves.toBe(destination);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("permits at most two approved tracking hops before the controlled Preview destination", async () => {
    const destination = `${PREVIEW_ORIGIN}/offert/jamfor/synthetic-token`;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://redirect.sendibm1.com/second-hop" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: destination } }));

    await expect(resolvePreviewMarketplaceEmailLink({
      body: '<a href="https://r.brevolinks.com/click-id">open</a>',
      kind: "customer",
      origin: PREVIEW_ORIGIN,
      fetchImpl,
    })).resolves.toBe(destination);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails closed for untrusted redirectors, wrong origins, wrong paths, HTTP and long chains", async () => {
    const cases = [
      { body: '<a href="https://evil.example.com/click">open</a>', location: `${PREVIEW_ORIGIN}/offert/svara/token`, calls: 0 },
      { body: '<a href="https://r.brevolinks.com/click">open</a>', location: "https://evil.example.com/offert/svara/token", calls: 1 },
      { body: '<a href="https://r.brevolinks.com/click">open</a>', location: `${PREVIEW_ORIGIN}/admin/token`, calls: 1 },
      { body: '<a href="https://r.brevolinks.com/click">open</a>', location: "http://proffera-jhap-safe-preview.vercel.app/offert/svara/token", calls: 1 },
    ];

    for (const testCase of cases) {
      const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: testCase.location } }));
      await expect(resolvePreviewMarketplaceEmailLink({
        body: testCase.body,
        kind: "guest",
        origin: PREVIEW_ORIGIN,
        fetchImpl,
      })).resolves.toBeNull();
      expect(fetchImpl).toHaveBeenCalledTimes(testCase.calls);
    }

    const chainFetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://r.brevolinks.com/another-hop" },
    }));
    await expect(resolvePreviewMarketplaceEmailLink({
      body: '<a href="https://r.brevolinks.com/start">open</a>',
      kind: "guest",
      origin: PREVIEW_ORIGIN,
      fetchImpl: chainFetch,
    })).resolves.toBeNull();
    expect(chainFetch).toHaveBeenCalledTimes(2);
  });

  it("does not follow more than four tracking candidates", async () => {
    const body = Array.from({ length: 8 }, (_, index) => `<a href="https://r.brevolinks.com/${index}">x</a>`).join("");
    const fetchImpl = vi.fn(async () => new Response("no redirect", { status: 200 }));
    await expect(resolvePreviewMarketplaceEmailLink({
      body,
      kind: "review",
      origin: PREVIEW_ORIGIN,
      fetchImpl,
    })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});
