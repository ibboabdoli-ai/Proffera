import { describe, expect, it } from "vitest";

import { directoryGuestMatchRadius, rankDirectoryGuestCandidates } from "./directory-guest";

const lead = { category: "VVS", service_type: "VVS / Rörmokare", city: "Södertälje" };
const candidate = {
  profileId: "11111111-1111-4111-8111-111111111111",
  slug: "ror-ab",
  companyName: "Rör AB",
  city: "Södertälje",
  municipality: "Södertälje",
  categorySlug: "vvs",
  serviceSlug: "vvs",
  serviceName: "VVS / Rörmokare",
  serviceCategory: "VVS",
  qualityScore: 95,
};

describe("directory guest marketplace ranking", () => {
  it("returns a local compatible company without claiming a confirmed service area", () => {
    const result = rankDirectoryGuestCandidates(lead, [candidate]);
    expect(result).toHaveLength(1);
    expect(result[0]?.serviceAreaConfirmed).toBe(false);
    expect(result[0]?.reasons).toContain("lokal kandidat – serviceområde ej bekräftat");
  });

  it("excludes a company in another city when a city was requested", () => {
    expect(rankDirectoryGuestCandidates(lead, [{ ...candidate, city: "Malmö", municipality: "Malmö" }])).toEqual([]);
  });

  it("does not treat a short city-name prefix as a local match", () => {
    const lundLead = { ...lead, city: "Lund" };
    const lundbyCandidate = { ...candidate, city: "Lundby", municipality: "Lundby" };
    expect(rankDirectoryGuestCandidates(lundLead, [lundbyCandidate])).toEqual([]);
  });

  it("excludes an incompatible service category", () => {
    expect(rankDirectoryGuestCandidates(lead, [{ ...candidate, categorySlug: "maleri", serviceName: "Målning", serviceCategory: "Måleri" }])).toEqual([]);
  });

  it("deduplicates a profile and keeps its strongest service match", () => {
    const broad = { ...candidate, serviceSlug: "annat-vvs", serviceName: "Annan VVS", qualityScore: 90 };
    const result = rankDirectoryGuestCandidates(lead, [broad, candidate]);
    expect(result).toHaveLength(1);
    expect(result[0]?.serviceSlug).toBe("vvs");
  });

  it("returns at most five candidates", () => {
    const rows = Array.from({ length: 9 }, (_, index) => ({
      ...candidate,
      profileId: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
      slug: `ror-ab-${index}`,
      companyName: `Rör AB ${index}`,
      qualityScore: 95 - index,
    }));
    expect(rankDirectoryGuestCandidates(lead, rows)).toHaveLength(5);
  });

  it("uses real coordinates and the smallest radius that yields three good candidates", () => {
    const nearbyLead = {
      ...lead,
      customer_latitude: 59.1955,
      customer_longitude: 17.6253,
    };
    const rows = [
      { ...candidate, profileId: "11111111-1111-4111-8111-111111111111", latitude: 59.20, longitude: 17.63 },
      { ...candidate, profileId: "22222222-2222-4222-8222-222222222222", companyName: "Rör B", latitude: 59.21, longitude: 17.65 },
      { ...candidate, profileId: "33333333-3333-4333-8333-333333333333", companyName: "Rör C", latitude: 59.23, longitude: 17.70 },
      { ...candidate, profileId: "44444444-4444-4444-8444-444444444444", companyName: "Rör D", latitude: 59.36, longitude: 17.90 },
    ];

    const result = rankDirectoryGuestCandidates(nearbyLead, rows);

    expect(result).toHaveLength(3);
    expect(result.every((item) => item.distanceKm !== null && item.distanceKm <= 10)).toBe(true);
    expect(directoryGuestMatchRadius(result)).toBe(10);
  });

  it("excludes a candidate without coordinates when the lead has coordinates", () => {
    const nearbyLead = { ...lead, customer_latitude: 59.1955, customer_longitude: 17.6253 };

    expect(rankDirectoryGuestCandidates(nearbyLead, [{ ...candidate, latitude: null, longitude: null }])).toEqual([]);
  });

  it("treats a 0,0 lead coordinate pair as missing and falls back to locality", () => {
    const placeholderLead = { ...lead, customer_latitude: 0, customer_longitude: 0 };
    const result = rankDirectoryGuestCandidates(placeholderLead, [{ ...candidate, latitude: null, longitude: null }]);

    expect(result).toHaveLength(1);
    expect(result[0]?.distanceKm).toBeNull();
    expect(result[0]?.reasons).toContain("lokal kandidat – serviceområde ej bekräftat");
  });

  it("expands toward 25 and 50 km only when needed instead of filling with weak matches", () => {
    const nearbyLead = { ...lead, customer_latitude: 59.1955, customer_longitude: 17.6253 };
    const rows = [
      { ...candidate, profileId: "11111111-1111-4111-8111-111111111111", latitude: 59.20, longitude: 17.63 },
      { ...candidate, profileId: "22222222-2222-4222-8222-222222222222", companyName: "Rör B", latitude: 59.30, longitude: 17.70 },
      { ...candidate, profileId: "33333333-3333-4333-8333-333333333333", companyName: "Rör C", latitude: 59.32, longitude: 17.75 },
      { ...candidate, profileId: "44444444-4444-4444-8444-444444444444", companyName: "Weak", qualityScore: 0, serviceName: "VVS", latitude: 59.50, longitude: 17.80 },
    ];

    const result = rankDirectoryGuestCandidates(nearbyLead, rows);

    expect(result).toHaveLength(3);
    expect(result.some((item) => item.companyName === "Weak")).toBe(false);
    expect(directoryGuestMatchRadius(result)).toBe(25);
  });

  it("honors a confirmed service-area radius and excludes a provider outside it", () => {
    const nearbyLead = { ...lead, customer_latitude: 59.1955, customer_longitude: 17.6253 };
    const result = rankDirectoryGuestCandidates(nearbyLead, [{
      ...candidate,
      latitude: 59.30,
      longitude: 17.70,
      serviceAreaRadiusKm: 5,
    }]);

    expect(result).toEqual([]);
  });

  it("marks a conflict-free SCB business-domain email as an internal official outreach contact", () => {
    const result = rankDirectoryGuestCandidates(lead, [{
      ...candidate,
      recipientEmail: "offert@rorfirma.se",
      scbConflicts: [],
    }]);

    expect(result[0]?.recipientEmail).toBe("offert@rorfirma.se");
    expect(result[0]?.contactBasis).toBe("official_business_register");
  });

  it("does not automate outreach to public-mailbox or conflicting SCB contact data", () => {
    const publicMailbox = rankDirectoryGuestCandidates(lead, [{ ...candidate, recipientEmail: "rorfirma@gmail.com", scbConflicts: [] }]);
    const conflict = rankDirectoryGuestCandidates(lead, [{ ...candidate, recipientEmail: "offert@rorfirma.se", scbConflicts: [{ code: "sni_no_overlap" }] }]);

    expect(publicMailbox[0]?.recipientEmail).toBe("");
    expect(conflict[0]?.recipientEmail).toBe("");
  });
});
