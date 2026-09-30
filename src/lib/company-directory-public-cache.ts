import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { getSql } from "@/lib/db/server";

// v3 intentionally retires the pre-0068 cache generation after the controlled
// workplace-authority reconciliation so demoted profiles cannot survive in v2.
// Safe published + unclaimed juridical Directory projections are explicitly
// invalidated on publication, claim, revalidation, and profile mutations. Keep
// a 24-hour TTL only as a fallback so crawler repeats do not wake Neon every
// five minutes when no underlying public data has changed.
export const PUBLIC_DIRECTORY_CACHE_TTL_SECONDS = 24 * 60 * 60;

// Cache only proven misses for a short window. Positive claimed/private results
// deliberately bypass this cache so entitlement and ownership state remain
// request-fresh. The normal profile invalidation tag also evicts these misses.
export const PUBLIC_DIRECTORY_MISS_CACHE_TTL_SECONDS = 30 * 60;

const PUBLIC_DIRECTORY_PROFILE_CACHE_NAMESPACE = "public-directory-published-juridical-v4";
const PUBLIC_DIRECTORY_EXTRAS_CACHE_NAMESPACE = "public-directory-profile-extras-v3";
const PUBLIC_DIRECTORY_MISS_CACHE_NAMESPACE = "public-directory-miss-v2";
const PUBLIC_DIRECTORY_ROUTING_MISS_CACHE_NAMESPACE = "public-directory-routing-miss-v2";
const PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG = "public-directory-profile:v3:all";
const PUBLIC_DIRECTORY_EXTRAS_GLOBAL_TAG = "public-directory-extras:v3:all";
export const PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG = "public-directory-location-suggestions:v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicDirectoryCacheDecision<T> = {
  cache: boolean;
  value: T;
  authorityExpiresAt?: string | null;
};

export type PublicDirectoryCacheReadInput<T> = {
  keyParts: string[];
  tags: string[];
  revalidate: number;
  loader: () => Promise<PublicDirectoryCacheDecision<T>>;
};

export type PublicDirectoryCacheAdapter = {
  read<T>(input: PublicDirectoryCacheReadInput<T>): Promise<T>;
  invalidate(tag: string): void;
};

class PublicDirectoryCacheBypass extends Error {
  constructor(readonly value: unknown) {
    super("Public Directory cache bypass");
    this.name = "PublicDirectoryCacheBypass";
  }
}

const nextCacheAdapter: PublicDirectoryCacheAdapter = {
  async read<T>(input: PublicDirectoryCacheReadInput<T>): Promise<T> {
    const cached = unstable_cache(
      async () => {
        const decision = await input.loader();
        if (!decision.cache) throw new PublicDirectoryCacheBypass(decision.value);
        return decision.value;
      },
      input.keyParts,
      { revalidate: input.revalidate, tags: input.tags },
    );

    try {
      return await cached();
    } catch (error) {
      if (error instanceof PublicDirectoryCacheBypass) return error.value as T;
      throw error;
    }
  },
  invalidate(tag: string) {
    revalidateTag(tag, { expire: 0 });
  },
};

const testPassthroughAdapter: PublicDirectoryCacheAdapter = {
  async read<T>(input: PublicDirectoryCacheReadInput<T>): Promise<T> {
    return (await input.loader()).value;
  },
  invalidate() {},
};

let testAdapter: PublicDirectoryCacheAdapter | null = null;

function activeAdapter() {
  if (testAdapter) return testAdapter;
  return process.env.NODE_ENV === "test" ? testPassthroughAdapter : nextCacheAdapter;
}

export function setPublicDirectoryCacheAdapterForTests(adapter: PublicDirectoryCacheAdapter | null) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Public Directory cache test adapter is available only in tests");
  }
  testAdapter = adapter;
}

function tagToken(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function publicDirectoryProfileCacheTag(slug: string) {
  return `public-directory-profile:v3:${tagToken(slug)}`;
}

export function publicDirectoryExtrasCacheTag(profileId: string) {
  return `public-directory-extras:v3:${tagToken(profileId)}`;
}

function publicDirectoryProfileTags(slug: string) {
  return [publicDirectoryProfileCacheTag(slug), PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG];
}

export async function readPublicDirectoryProfileCache<T>(
  slug: string,
  loader: () => Promise<PublicDirectoryCacheDecision<T>>,
): Promise<T> {
  const normalized = tagToken(slug);
  const cached = await activeAdapter().read({
    keyParts: [PUBLIC_DIRECTORY_PROFILE_CACHE_NAMESPACE, normalized],
    tags: publicDirectoryProfileTags(normalized),
    revalidate: PUBLIC_DIRECTORY_CACHE_TTL_SECONDS,
    loader: async () => {
      const decision = await loader();
      return {
        cache: decision.cache,
        value: {
          value: decision.value,
          authorityExpiresAt: decision.authorityExpiresAt ?? null,
        },
      };
    },
  });

  // This cache namespace predates authority-bound envelopes. Treat any
  // remaining raw positive as expired instead of trusting it or returning an
  // undefined projection during the rollout.
  if (!cached || typeof cached !== "object" || !("value" in cached)) {
    return (await loader()).value;
  }

  if (cached.authorityExpiresAt) {
    const expiresAt = Date.parse(cached.authorityExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return (await loader()).value;
    }
  }

  return cached.value;
}

export async function readPublicDirectoryMissCache<T>(
  slug: string,
  loader: () => Promise<PublicDirectoryCacheDecision<T>>,
): Promise<T> {
  const normalized = tagToken(slug);

  // A negative Directory cache entry is safe only when the database is
  // available and has actually proved the slug is missing. If the SQL client
  // is unavailable, bypass the persistent miss cache entirely so a temporary
  // infrastructure/configuration failure can never become a 30-minute 404.
  if (!getSql()) return (await loader()).value;

  return activeAdapter().read({
    keyParts: [PUBLIC_DIRECTORY_MISS_CACHE_NAMESPACE, normalized],
    tags: publicDirectoryProfileTags(normalized),
    revalidate: PUBLIC_DIRECTORY_MISS_CACHE_TTL_SECONDS,
    loader,
  });
}

export async function readPublicDirectoryRoutingMissCache<T>(
  slug: string,
  loader: () => Promise<PublicDirectoryCacheDecision<T>>,
): Promise<T> {
  const normalized = tagToken(slug);
  return activeAdapter().read({
    keyParts: [PUBLIC_DIRECTORY_ROUTING_MISS_CACHE_NAMESPACE, normalized],
    tags: publicDirectoryProfileTags(normalized),
    revalidate: PUBLIC_DIRECTORY_MISS_CACHE_TTL_SECONDS,
    loader,
  });
}

export async function readPublicDirectoryExtrasCache<T>(
  profileId: string,
  loader: () => Promise<T>,
): Promise<T> {
  const normalized = tagToken(profileId);
  return activeAdapter().read({
    keyParts: [PUBLIC_DIRECTORY_EXTRAS_CACHE_NAMESPACE, normalized],
    tags: [publicDirectoryExtrasCacheTag(normalized), PUBLIC_DIRECTORY_EXTRAS_GLOBAL_TAG],
    revalidate: PUBLIC_DIRECTORY_CACHE_TTL_SECONDS,
    loader: async () => ({ cache: true, value: await loader() }),
  });
}

export function invalidateAllPublicDirectoryProfileCaches() {
  activeAdapter().invalidate(PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG);
}

export function invalidateAllPublicDirectoryExtrasCaches() {
  activeAdapter().invalidate(PUBLIC_DIRECTORY_EXTRAS_GLOBAL_TAG);
}

export function invalidatePublishedDirectoryLocationSuggestionsCache() {
  activeAdapter().invalidate(PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG);
}

export function invalidateAllPublicDirectoryPublicCaches() {
  invalidateAllPublicDirectoryProfileCaches();
  invalidateAllPublicDirectoryExtrasCaches();
  invalidatePublishedDirectoryLocationSuggestionsCache();
}

export function invalidatePublicDirectoryProfileCache(slug: string) {
  const normalized = tagToken(slug);
  if (!normalized) {
    invalidateAllPublicDirectoryProfileCaches();
    return;
  }
  activeAdapter().invalidate(publicDirectoryProfileCacheTag(normalized));
}

export function invalidatePublicDirectoryExtrasCache(profileId: string) {
  const normalized = tagToken(profileId);
  if (!normalized) {
    invalidateAllPublicDirectoryExtrasCaches();
    return;
  }
  activeAdapter().invalidate(publicDirectoryExtrasCacheTag(normalized));
}

export function invalidatePublicDirectoryPublicProjection(input: {
  slug: string;
  profileId: string;
}) {
  invalidatePublicDirectoryProfileCache(input.slug);
  invalidatePublicDirectoryExtrasCache(input.profileId);
  invalidatePublishedDirectoryLocationSuggestionsCache();
}

export async function invalidatePublicDirectoryPublicProjectionByProfileId(profileId: string) {
  const normalized = tagToken(profileId);
  invalidatePublishedDirectoryLocationSuggestionsCache();
  if (!UUID_PATTERN.test(normalized)) {
    invalidateAllPublicDirectoryPublicCaches();
    return;
  }

  if (process.env.NODE_ENV === "test" && testAdapter === null) return;

  const sql = getSql();
  if (!sql) {
    invalidateAllPublicDirectoryProfileCaches();
    invalidatePublicDirectoryExtrasCache(normalized);
    return;
  }

  let slug = "";
  try {
    const rows = await sql`
      select public_slug
      from company_directory_profiles
      where id = ${normalized}::uuid
      limit 1
    `;
    slug = tagToken(rows[0]?.public_slug);
  } catch {
    // Fail closed below with global profile invalidation.
  }

  if (slug) invalidatePublicDirectoryProfileCache(slug);
  else invalidateAllPublicDirectoryProfileCaches();
  invalidatePublicDirectoryExtrasCache(normalized);
}
