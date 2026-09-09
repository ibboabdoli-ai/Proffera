import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { getSql } from "@/lib/db/server";

export const PUBLIC_DIRECTORY_CACHE_TTL_SECONDS = 5 * 60;

const PUBLIC_DIRECTORY_PROFILE_CACHE_NAMESPACE = "public-directory-published-juridical-v2";
const PUBLIC_DIRECTORY_EXTRAS_CACHE_NAMESPACE = "public-directory-profile-extras-v2";
const PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG = "public-directory-profile:v2:all";
const PUBLIC_DIRECTORY_EXTRAS_GLOBAL_TAG = "public-directory-extras:v2:all";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicDirectoryCacheDecision<T> = {
  cache: boolean;
  value: T;
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
    // Safety changes require a blocking miss on the next read. SWR profiles such
    // as "max" could still serve the stale public value once after a claim or
    // privacy transition, so use immediate expiration for this boundary.
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
  return `public-directory-profile:v2:${tagToken(slug)}`;
}

export function publicDirectoryExtrasCacheTag(profileId: string) {
  return `public-directory-extras:v2:${tagToken(profileId)}`;
}

export async function readPublicDirectoryProfileCache<T>(
  slug: string,
  loader: () => Promise<PublicDirectoryCacheDecision<T>>,
): Promise<T> {
  const normalized = tagToken(slug);
  return activeAdapter().read({
    keyParts: [PUBLIC_DIRECTORY_PROFILE_CACHE_NAMESPACE, normalized],
    tags: [publicDirectoryProfileCacheTag(normalized), PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG],
    revalidate: PUBLIC_DIRECTORY_CACHE_TTL_SECONDS,
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

export function invalidatePublicDirectoryProfileCache(slug: string) {
  const normalized = tagToken(slug);
  if (!normalized) {
    activeAdapter().invalidate(PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG);
    return;
  }
  activeAdapter().invalidate(publicDirectoryProfileCacheTag(normalized));
}

export function invalidatePublicDirectoryExtrasCache(profileId: string) {
  const normalized = tagToken(profileId);
  if (!normalized) {
    activeAdapter().invalidate(PUBLIC_DIRECTORY_EXTRAS_GLOBAL_TAG);
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
}

/**
 * Mutation-side invalidation for paths that naturally own only a profile id.
 * The extra lookup runs only after a successful mutation, never on public read
 * traffic. If the slug cannot be resolved, fail closed by expiring the global
 * public-profile tag rather than leaving a possibly unsafe cached page alive.
 */
export async function invalidatePublicDirectoryPublicProjectionByProfileId(profileId: string) {
  const normalized = tagToken(profileId);
  if (!UUID_PATTERN.test(normalized)) {
    activeAdapter().invalidate(PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG);
    activeAdapter().invalidate(PUBLIC_DIRECTORY_EXTRAS_GLOBAL_TAG);
    return;
  }

  // Existing unit tests that exercise business mutations do not run inside a
  // Next incremental-cache runtime. They get a deliberate no-op by default;
  // cache-specific tests install an explicit adapter and exercise invalidation.
  if (process.env.NODE_ENV === "test" && testAdapter === null) return;

  const sql = getSql();
  if (!sql) {
    activeAdapter().invalidate(PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG);
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
    // The data mutation has already succeeded. Global expiration is the
    // fail-closed fallback if the narrow tag cannot be resolved.
  }

  if (slug) invalidatePublicDirectoryProfileCache(slug);
  else activeAdapter().invalidate(PUBLIC_DIRECTORY_PROFILE_GLOBAL_TAG);
  invalidatePublicDirectoryExtrasCache(normalized);
}
