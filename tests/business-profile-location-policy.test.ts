import { describe, expect, it } from "vitest";

import {
  resolvePublicBusinessProfileLocation,
  type BusinessProfileLocationCandidate,
} from "../src/lib/business-profile-location-policy";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

function location(
  overrides: Partial<BusinessProfileLocationCandidate> = {},
): BusinessProfileLocationCandidate {
  return {
    profileId: PROFILE_ID,
    purpose: "workplace",
    visibility: "public",
    isVisitable: true,
    sourceType: "owner",
    claimedWorkspaceId: WORKSPACE_ID,
    sourceWorkspaceId: WORKSPACE_ID,
    addressLine1: "Storgatan 1",
    postalCode: "151 00",
    city: "Södertälje",
    municipality: "Södertälje",
    latitude: 59.1955,
    longitude: 17.6253,
    confirmedAt: "2026-08-24T12:00:00.000Z",
    ...overrides,
  };
}

describe("Business Profile public location policy", () => {
  it("allows an exact map point only for a confirmed, visitable, public business location", () => {
    expect(resolvePublicBusinessProfileLocation(location())).toEqual({
      profileId: PROFILE_ID,
      purpose: "workplace",
      visibility: "public",
      isVisitable: true,
      addressLine1: "Storgatan 1",
      postalCode: "151 00",
      city: "Södertälje",
      municipality: "Södertälje",
      mapPoint: { latitude: 59.1955, longitude: 17.6253 },
    });
  });

  it("never exposes a private location", () => {
    expect(resolvePublicBusinessProfileLocation(location({ visibility: "private" }))).toBeNull();
  });

  it("keeps approximate locations locality-only with no precise address or coordinates", () => {
    expect(resolvePublicBusinessProfileLocation(location({ visibility: "approximate" }))).toEqual({
      profileId: PROFILE_ID,
      purpose: "workplace",
      visibility: "approximate",
      isVisitable: false,
      addressLine1: "",
      postalCode: "",
      city: "Södertälje",
      municipality: "Södertälje",
      mapPoint: null,
    });
  });

  it("does not promote registered or postal truth into a storefront/map location", () => {
    const registered = resolvePublicBusinessProfileLocation(location({
      purpose: "registered",
      sourceType: "official",
      claimedWorkspaceId: null,
      sourceWorkspaceId: null,
    }));

    expect(registered).toMatchObject({
      purpose: "registered",
      visibility: "approximate",
      isVisitable: false,
      addressLine1: "",
      postalCode: "",
      mapPoint: null,
    });
  });

  it("downgrades unconfirmed or non-visitable public candidates to approximate output", () => {
    const unconfirmed = resolvePublicBusinessProfileLocation(location({ confirmedAt: null }));
    const nonVisitable = resolvePublicBusinessProfileLocation(location({ isVisitable: false }));

    expect(unconfirmed).toMatchObject({ visibility: "approximate", mapPoint: null, addressLine1: "" });
    expect(nonVisitable).toMatchObject({ visibility: "approximate", mapPoint: null, addressLine1: "" });
  });

  it("rejects owner location data from a Workspace that does not own the profile", () => {
    expect(resolvePublicBusinessProfileLocation(location({
      sourceWorkspaceId: "33333333-3333-4333-8333-333333333333",
    }))).toBeNull();
  });

  it("keeps an exact public address but withholds map coordinates when the coordinate pair is invalid", () => {
    const result = resolvePublicBusinessProfileLocation(location({ latitude: 1234 }));

    expect(result).toMatchObject({
      visibility: "public",
      isVisitable: true,
      addressLine1: "Storgatan 1",
      mapPoint: null,
    });
  });

  it("treats whitespace-only coordinate strings as missing rather than zero", () => {
    const result = resolvePublicBusinessProfileLocation(location({
      latitude: "   ",
      longitude: "\t",
    }));

    expect(result).toMatchObject({
      visibility: "public",
      isVisitable: true,
      addressLine1: "Storgatan 1",
      mapPoint: null,
    });
  });
});
