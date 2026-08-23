import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const revalidationSource = readFileSync(
  new URL("./company-directory-full-revalidation.ts", import.meta.url),
  "utf8",
);

describe("company directory Review recovery SQL", () => {
  it("casts jsonb_build_object recovery values to text for PostgreSQL parameter typing", () => {
    expect(revalidationSource).toContain(
      "'profileUpdatedToken', ${input.profileUpdatedToken}::text",
    );
    expect(revalidationSource).toContain(
      "'officialFactsLastSyncedToken', ${input.factsLastSyncedToken}::text",
    );
    expect(revalidationSource).toContain(
      "'officialFactsSourcePayloadHash', ${input.factsSourcePayloadHash}::text",
    );
  });
});
