import { describe, expect, it } from "vitest";

import { assessCompanyDirectoryPilotWorkplace } from "@/lib/company-directory-pilot-location";

const profile = {
  addressLine1: "Registrerad gata 1",
  postalCode: "151 00",
  city: "Södertälje",
  municipality: "Södertälje",
};

function workplace(input: {
  addressLine?: string;
  postalCode?: string;
  city?: string;
  municipality?: string;
} = {}) {
  return {
    cfarNumber: "12345678",
    municipality: input.municipality ?? "Stockholm",
    visitingAddress: {
      addressLine: input.addressLine ?? "Arbetsplatsgatan 2",
      postalCode: input.postalCode ?? "11122",
      city: input.city ?? "Stockholm",
    },
  };
}

describe("Directory pilot workplace authority", () => {
  it("accepts one complete physical SCB workplace inside the pilot", () => {
    expect(assessCompanyDirectoryPilotWorkplace(profile, [workplace()])).toMatchObject({
      eligible: true,
      reason: "pilot_workplace",
      address: {
        city: "Stockholm",
        municipality: "Stockholm",
      },
    });
  });

  it("lets a canonical pilot workplace win even when the registered profile address is outside the pilot", () => {
    const outsidePilotProfile = {
      ...profile,
      city: "Uppsala",
      municipality: "Uppsala",
    };

    expect(assessCompanyDirectoryPilotWorkplace(outsidePilotProfile, [workplace()])).toMatchObject({
      eligible: true,
      reason: "pilot_workplace",
      address: {
        city: "Stockholm",
        municipality: "Stockholm",
      },
    });
  });

  it("does not let a pilot profile address override a physical workplace outside the pilot", () => {
    expect(assessCompanyDirectoryPilotWorkplace(profile, [workplace({
      city: "Uppsala",
      municipality: "Uppsala",
    })])).toMatchObject({
      eligible: false,
      reason: "outside_pilot_area",
    });
  });

  it("fails closed when workplace authority is missing or incomplete", () => {
    expect(assessCompanyDirectoryPilotWorkplace(profile, [])).toEqual({
      eligible: false,
      reason: "no_workplaces",
      address: null,
    });

    expect(assessCompanyDirectoryPilotWorkplace(profile, {})).toEqual({
      eligible: false,
      reason: "no_workplaces",
      address: null,
    });

    expect(assessCompanyDirectoryPilotWorkplace(profile, [workplace({ addressLine: "" })])).toEqual({
      eligible: false,
      reason: "no_complete_workplace",
      address: null,
    });
  });

  it("fails closed for multiple workplaces even when one is in the pilot", () => {
    expect(assessCompanyDirectoryPilotWorkplace(profile, [
      workplace(),
      workplace({ city: "Uppsala", municipality: "Uppsala" }),
    ])).toEqual({
      eligible: false,
      reason: "ambiguous_workplaces",
      address: null,
    });
  });
});
