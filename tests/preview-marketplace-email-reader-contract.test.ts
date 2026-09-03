import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src/app/api/e2e/marketplace/email/route.ts"),
  "utf8",
);

describe("Preview Marketplace email reader boundary", () => {
  it("uses only canonical Preview email configuration and exact E2E runtime gating", () => {
    expect(source).toContain("isPreviewMarketplaceE2eRuntime()");
    expect(source).toContain("resolvePreviewMarketplaceE2eRunId(request.headers)");
    expect(source).toContain("resolveBrevoApiKey()");
    expect(source).toContain("resolvePreviewEmailRecipient()");
    expect(source).not.toContain("process.env.BREVO_API_KEY");
  });

  it("returns only controlled Preview links and checks the synthetic original recipient", () => {
    expect(source).toContain("url.origin !== origin");
    expect(source).toContain("/offert/svara/");
    expect(source).toContain("/offert/jamfor/");
    expect(source).toContain("/review/marketplace/");
    expect(source).toContain("originalRecipientObserved");
    expect(source).not.toContain("previewRecipient:");
  });

  it("uses persisted provider message IDs for exact guest/customer reads before loading message bodies", () => {
    expect(source).toContain("previewMarketplaceE2eUuid(\"provider\", suiteRunId)");
    expect(source).toContain("invitation.provider_message_id as guest_provider_message_id");
    expect(source).toContain("customer_access.provider_message_id as customer_provider_message_id");
    expect(source).toContain('url.searchParams.set("messageId", messageId)');
    expect(source).toContain("marker.providerMessageId\n    ? await listTransactionalEmailByMessageId(marker.providerMessageId, apiKey)");
    expect(source).toContain("marker.providerMessageId\n    ? candidates.slice(0, 1)");
    expect(source).not.toContain("String(item.messageId ?? \"\").trim() === marker.providerMessageId");
  });

  it("keeps only the review fallback as a bounded sink scan", () => {
    expect(source).toContain('url.searchParams.set("limit", "20")');
    expect(source).toContain(": await listTransactionalEmails(sink, apiKey)");
    expect(source).toContain("candidates.filter((item) => likelyMarkerCandidate(item, marker)).slice(0, 3)");
  });

  it("emits only bounded non-secret pending diagnostics", () => {
    expect(source).toContain('lookupMode = marker.providerMessageId ? "message_id" : "recipient"');
    expect(source).toContain("providerMessageIdPresent: Boolean(marker.providerMessageId)");
    expect(source).toContain("candidateCount: candidates.length");
    expect(source).toContain("markerMatchedCount");
    expect(source).toContain("controlledLinkMatchedCount");
    expect(source).toContain("Preview Marketplace E2E email lookup pending");
    expect(source).not.toContain("providerMessageId: marker.providerMessageId");
  });

  it("does not burst Brevo during polling and retries one provider-directed rate limit", () => {
    expect(source).toContain("response.status === 429 && attempt === 0");
    expect(source).toContain("boundedRetryDelayMs(response)");
    expect(source).toContain("const originalList = await listTransactionalEmails(original, apiKey)");
    expect(source).not.toContain("Promise.all([\n    listTransactionalEmails(sink, apiKey)");
    expect(source.indexOf("const originalList = await listTransactionalEmails(original, apiKey)")).toBeGreaterThan(
      source.indexOf("const link = controlledLink(body, kind)"),
    );
  });
});
