import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MARKETPLACE_FUNNEL_EVENT_NAMES,
  buildMarketplaceFunnelPostHogEvent,
  sanitizeMarketplaceFunnelEventInput,
  sanitizeMarketplaceFunnelPostHogEvent,
} from "@/lib/analytics/marketplace-funnel-events";
import { sanitizePostHogEvent } from "@/lib/analytics/posthog-send-boundary";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Marketplace launch-funnel analytics contract", () => {
  it("keeps the event taxonomy bounded to the approved launch funnel", () => {
    expect(MARKETPLACE_FUNNEL_EVENT_NAMES).toEqual([
      "marketplace_discovery_search_completed",
      "marketplace_request_submitted",
      "marketplace_invitation_outcome",
      "marketplace_provider_offer_submitted",
      "marketplace_customer_selection_completed",
      "marketplace_service_job_completed",
      "marketplace_verified_review_submitted",
    ]);
  });

  it("drops arbitrary and sensitive caller properties while preserving coarse allowlisted values", () => {
    const event = buildMarketplaceFunnelPostHogEvent({
      event: "marketplace_discovery_search_completed",
      properties: {
        locale: "sv",
        result_band: "6-20",
        email: "person@example.com",
        phone: "+46700000000",
        organization_number: "5561234567",
        address: "Secret 1",
        latitude: 59.3,
        longitude: 18.0,
        quote_request_id: "11111111-1111-4111-8111-111111111111",
        workspace_id: "22222222-2222-4222-8222-222222222222",
        service_job_id: "33333333-3333-4333-8333-333333333333",
        provider_id: "provider-secret",
        claim_id: "claim-secret",
        url: "https://example.test/path?token=secret#fragment",
        referrer: "https://example.test/private",
        free_text: "private details",
      },
    }, "preview");

    expect(event).toEqual({
      event: "marketplace_discovery_search_completed",
      properties: {
        locale: "sv",
        result_band: "6-20",
        proffera_environment: "preview",
        $process_person_profile: false,
      },
    });
  });

  it("fails closed for unknown events, invalid environments and malformed properties", () => {
    expect(sanitizeMarketplaceFunnelEventInput({ event: "identify", properties: {} })).toBeNull();
    expect(sanitizeMarketplaceFunnelEventInput({ event: "marketplace_request_submitted", properties: "bad" })).toBeNull();
    expect(buildMarketplaceFunnelPostHogEvent({ event: "marketplace_request_submitted" }, "production")).not.toBeNull();
    expect(buildMarketplaceFunnelPostHogEvent({ event: "marketplace_request_submitted" }, "preview")).not.toBeNull();
    expect(sanitizeMarketplaceFunnelPostHogEvent({
      event: "marketplace_request_submitted",
      properties: { proffera_environment: "development" },
    })).toBeNull();
  });

  it("preserves only anonymous PostHog identity fields added by the SDK at the final boundary", () => {
    const sanitized = sanitizePostHogEvent({
      event: "marketplace_provider_offer_submitted",
      properties: {
        locale: "en",
        proffera_environment: "production",
        distinct_id: "anonymous-distinct-id",
        $device_id: "anonymous-device-id",
        $session_id: "anonymous-session-id",
        $window_id: "anonymous-window-id",
        token: "phc_abcdefghijklmnopqrstuvwxyz1234567890",
        email: "must-not-pass@example.com",
        $set: { email: "must-not-pass@example.com" },
      },
    });

    expect(sanitized).toEqual({
      event: "marketplace_provider_offer_submitted",
      properties: {
        locale: "en",
        proffera_environment: "production",
        $process_person_profile: false,
        distinct_id: "anonymous-distinct-id",
        $device_id: "anonymous-device-id",
        $session_id: "anonymous-session-id",
        $window_id: "anonymous-window-id",
        token: "phc_abcdefghijklmnopqrstuvwxyz1234567890",
      },
    });
  });

  it("wires each milestone to a genuine success boundary without analytics identifiers", () => {
    const searchPage = source("src/components/company-directory/public-directory-search-page.tsx");
    const requestForm = source("src/features/quote-request/localized-quote-request-form.tsx");
    const invitationEmail = source("src/features/email/marketplace-guest-invitation-email.ts");
    const guestLayout = source("src/app/offert/svara/[token]/layout.tsx");
    const selectionAction = source("src/app/offert/jamfor/[token]/actions.ts");
    const selectionLayout = source("src/app/offert/jamfor/[token]/layout.tsx");
    const jobLayout = source("src/app/offert/jobb/[token]/layout.tsx");
    const reviewForm = source("src/app/review/[token]/verified-review-form.tsx");

    expect(searchPage).toContain('event="marketplace_discovery_search_completed"');
    expect(searchPage).toContain("result_band: resultBand(search.totalCount)");

    expect(requestForm.indexOf('event: "marketplace_request_submitted"')).toBeGreaterThan(requestForm.indexOf("if (!result.ok)"));

    expect(invitationEmail).toContain('url.searchParams.set("source", "invitation")');
    expect(invitationEmail).toContain("input.testMode ? input.replyUrl : marketplaceInvitationEntryUrl(input.replyUrl)");
    expect(guestLayout).toContain('event="marketplace_invitation_outcome"');
    expect(guestLayout).toContain('event="marketplace_provider_offer_submitted"');

    expect(selectionAction).toContain('if (result.ok) redirectWithState(token, locale, "selected")');
    expect(selectionLayout).toContain('value="selected"');
    expect(selectionLayout).toContain('event="marketplace_customer_selection_completed"');

    expect(jobLayout).toContain('value="completed"');
    expect(jobLayout).toContain('event="marketplace_service_job_completed"');

    expect(reviewForm.indexOf('event: "marketplace_verified_review_submitted"'))
      .toBeGreaterThan(reviewForm.indexOf("if (!response.ok)"));

    const analyticsSources = [searchPage, requestForm, guestLayout, selectionLayout, jobLayout, reviewForm].join("\n");
    for (const forbidden of [
      "quote_request_id",
      "workspace_id",
      "service_job_id",
      "provider_id",
      "claim_id",
      "personnummer",
      "organization_number",
    ]) {
      expect(analyticsSources).not.toContain(forbidden);
    }
  });
});
