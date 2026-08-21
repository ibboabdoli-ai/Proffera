import { describe, expect, it } from "vitest";

import { rankDirectoryGuestCandidates } from "./directory-guest";

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
});
