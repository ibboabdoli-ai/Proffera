import { describe, expect, it } from "vitest";

import { sanitizePostHogEvent } from "../src/lib/analytics/posthog-send-boundary";

describe("PostHog ingestion send boundary", () => {
  it("preserves only the public PostHog project token required for ingestion", () => {
    const projectToken = "phc_abcdefghijklmnopqrstuvwxyz1234567890";
    const event = sanitizePostHogEvent({
      event: "$pageview",
      properties: {
        token: projectToken,
        $current_url: "https://www.proffera.se/foretag?email=person@example.com#private",
        $pathname: "/foretag?token=secret#private",
        proffera_environment: "production",
        source: "direct",
        email: "person@example.com",
        auth_token: "customer-secret-token",
      },
    });

    expect(event?.properties).toEqual({
      $current_url: "https://www.proffera.se/foretag",
      $pathname: "/foretag",
      proffera_environment: "production",
      source: "direct",
      $process_person_profile: false,
      token: projectToken,
    });
    expect(JSON.stringify(event)).not.toContain("person@example.com");
    expect(JSON.stringify(event)).not.toContain("customer-secret-token");
  });

  it("drops arbitrary token values instead of forwarding them", () => {
    const event = sanitizePostHogEvent({
      event: "$pageview",
      properties: {
        token: "customer-secret-token",
        $current_url: "https://www.proffera.se/",
        $pathname: "/",
        proffera_environment: "production",
      },
    });

    expect(event?.properties).not.toHaveProperty("token");
  });

  it("continues to drop non-pageview events", () => {
    expect(
      sanitizePostHogEvent({
        event: "$identify",
        properties: { token: "phc_abcdefghijklmnopqrstuvwxyz1234567890" },
      }),
    ).toBeNull();
  });
});
