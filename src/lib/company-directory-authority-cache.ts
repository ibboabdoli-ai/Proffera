import { invalidatePublicDirectoryPublicProjectionByProfileId } from "@/lib/company-directory-public-cache";
import { invalidateMarketplaceHomeCompaniesCache } from "@/lib/public-read-cache";

/** Evicts both public projections after a committed authority-changing write. */
export async function invalidateCompanyDirectoryAuthorityCachesBestEffort(
  profileId: string,
  reason: string,
) {
  try {
    await invalidatePublicDirectoryPublicProjectionByProfileId(profileId);
  } catch (error) {
    console.error(`Failed to invalidate public Directory cache after ${reason}`, { profileId, error });
  }
  try {
    invalidateMarketplaceHomeCompaniesCache();
  } catch (error) {
    console.error(`Failed to invalidate Marketplace cache after ${reason}`, { profileId, error });
  }
}
