import "server-only";

import { revalidateTag } from "next/cache";

/**
 * One safety boundary for every cross-request cache that can contribute to a
 * public Directory company page. A global tag keeps mutation paths simple and
 * guarantees claim/privacy/publication transitions cannot leave a previously
 * public snapshot addressable until the TTL expires.
 */
export const PUBLIC_DIRECTORY_SHARED_CACHE_TAG = "public-directory-shared-v1";

/**
 * Expire shared public Directory data immediately after a successful write.
 * The 5-minute TTL remains the bounded fallback freshness contract for source
 * updates that do not require a fail-closed visibility transition.
 */
export function invalidatePublicDirectorySharedCache() {
  revalidateTag(PUBLIC_DIRECTORY_SHARED_CACHE_TAG, { expire: 0 });
}
