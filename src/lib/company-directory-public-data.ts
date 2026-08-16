import { cache } from "react";

import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";

/**
 * Deduplicate the public directory business lookup across generateMetadata and
 * the Server Component tree for one render request. React invalidates this
 * memoization between server requests, so publication/privacy changes are not
 * persisted in an application-level cache here.
 */
export const getPublicDirectoryBusinessForRequest = cache(getPublicDirectoryBusiness);
