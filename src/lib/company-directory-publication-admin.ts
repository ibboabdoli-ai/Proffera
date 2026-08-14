import "server-only";

import {
  publishCompanyDirectoryProfileIfSafe,
  type CompanyDirectoryPublicationResult,
} from "@/lib/company-directory-publication";
import { getPlatformAdmin } from "@/lib/platform-admin";

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
  return admin;
}

export async function publishCompanyDirectoryProfileFromAdmin(
  profileId: string,
): Promise<CompanyDirectoryPublicationResult> {
  await requireSuperAdmin();
  return publishCompanyDirectoryProfileIfSafe(profileId);
}
