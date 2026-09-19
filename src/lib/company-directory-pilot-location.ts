import { isDirectoryPilotLocation } from "@/lib/company-directory-policy";
import {
  resolveCompanyDirectoryCanonicalWorkplaceAddress,
  type DirectoryPublicAddress,
} from "@/lib/company-directory-scb-address";

export type CompanyDirectoryPilotWorkplaceAssessment =
  | {
      eligible: true;
      reason: "pilot_workplace";
      address: DirectoryPublicAddress;
    }
  | {
      eligible: false;
      reason: "no_workplaces" | "no_complete_workplace" | "ambiguous_workplaces" | "outside_pilot_area";
      address: DirectoryPublicAddress | null;
    };

/**
 * Decide pilot eligibility from the strict canonical physical workplace only.
 *
 * Registered/profile address fields are intentionally never accepted as pilot
 * authority. A company must have exactly one complete SCB workplace visiting
 * address, and that physical workplace must be inside the configured pilot.
 */
export function assessCompanyDirectoryPilotWorkplace(
  profile: DirectoryPublicAddress,
  workplaces: unknown,
): CompanyDirectoryPilotWorkplaceAssessment {
  const resolution = resolveCompanyDirectoryCanonicalWorkplaceAddress(profile, workplaces);
  if (resolution.status !== "resolved") {
    return {
      eligible: false,
      reason: resolution.reason,
      address: null,
    };
  }

  if (!isDirectoryPilotLocation(resolution.address)) {
    return {
      eligible: false,
      reason: "outside_pilot_area",
      address: resolution.address,
    };
  }

  return {
    eligible: true,
    reason: "pilot_workplace",
    address: resolution.address,
  };
}
