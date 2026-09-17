import { describe, expect, it } from "vitest";

import { generateMetadata } from "../src/app/areas/[slug]/page";

describe("PrimeView area indexing", () => {
  it("keeps bespoke area pages indexable", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "ealing" }) });

    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe("https://www.primeviewwindowcare.co.uk/areas/ealing");
  });

  it("noindexes generated area pages without removing their canonical route", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "hammersmith" }) });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("https://www.primeviewwindowcare.co.uk/areas/hammersmith");
  });

  it("returns empty metadata for an unknown area slug", async () => {
    await expect(generateMetadata({ params: Promise.resolve({ slug: "not-a-real-area" }) })).resolves.toEqual({});
  });
});
