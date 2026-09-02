import { describe, expect, it } from "vitest";

import { GET } from "../src/app/api/public-directory/category-image/[category]/route";

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const cacheControl = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800";

describe("Company Directory category image renderer", () => {
  it.each(["stadning", "unknown"])("renders %s through the real ImageResponse pipeline", async (category) => {
    const response = await GET(
      new Request(`https://www.proffera.se/api/public-directory/category-image/${category}`),
      { params: Promise.resolve({ category }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toBe(cacheControl);

    const body = new Uint8Array(await response.arrayBuffer());
    expect(body.byteLength).toBeGreaterThan(pngSignature.length);
    expect(Array.from(body.slice(0, pngSignature.length))).toEqual(pngSignature);
  });
});
