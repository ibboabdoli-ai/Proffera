"use server";

import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { isBolagsverketJuridicalOrganizationNumber } from "@/lib/bolagsverket-api-policy";
import { onboardJuridicalCompanyDirectoryByOrganizationNumber } from "@/lib/company-directory-juridical-onboarding";
import { normalizeSwedishOrganizationNumber } from "@/lib/company-directory-provider-activation-policy";

const ADMIN_ONBOARDING_PATH = "/admin/foretag/directory/lagg-till-foretag";

function statusPath(status: string) {
  const params = new URLSearchParams({ status });
  return `${ADMIN_ONBOARDING_PATH}?${params.toString()}`;
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "rate_limited") return "rate_limited";
  if (message === "organization_number") return "invalid";
  if (message === "private_identity") return "private_identity";
  return "source_error";
}

export async function addCompanyDirectoryFromAdminAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const organizationNumber = normalizeSwedishOrganizationNumber(
    formData.get("organizationNumber"),
  );

  let target = statusPath("invalid");

  if (organizationNumber && !isBolagsverketJuridicalOrganizationNumber(organizationNumber)) {
    target = statusPath("private_identity");
  } else if (organizationNumber) {
    try {
      const result = await onboardJuridicalCompanyDirectoryByOrganizationNumber({
        organizationNumber,
        rateLimit: {
          scope: "admin_directory_onboarding",
          identity: admin.userId,
        },
        source: "admin_onboarding",
      });

      if (!result.profile) {
        target = statusPath("not_ready");
      } else if (result.existed) {
        target = statusPath("existing");
      } else if (result.profile.publicationStatus === "published") {
        target = statusPath("added");
      } else {
        target = statusPath("review");
      }
    } catch (error) {
      target = statusPath(errorStatus(error));
    }
  }

  redirect(target);
}
