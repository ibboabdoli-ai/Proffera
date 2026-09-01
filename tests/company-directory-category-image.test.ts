import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  imageResponse: vi.fn(),
}));

vi.mock("next/og", () => ({
  ImageResponse: function ImageResponse(element: unknown, options: unknown) {
    mocks.imageResponse(element, options);
    return new Response("image", { status: 200, headers: { "content-type": "image/png" } });
  },
}));

import { GET } from "../src/app/api/public-directory/category-image/[category]/route";

function collectRenderedText(node: unknown): string[] {
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectRenderedText);
  if (!node || typeof node !== "object") return [];

  const props = (node as { props?: { children?: unknown } }).props;
  return props ? collectRenderedText(props.children) : [];
}

describe("Company Directory category image", () => {
  beforeEach(() => {
    mocks.imageResponse.mockReset();
  });

  it.each([
    ["stadning", "Städning"],
    ["hemservice", "Hemservice"],
    ["flytt", "Flytt"],
    ["elektriker", "Elektriker"],
    ["vvs", "VVS"],
    ["maleri", "Måleri"],
    ["snickeri", "Snickeri"],
    ["tradgard", "Trädgård"],
  ])("renders %s without dynamic fallback-font glyphs", async (category, label) => {
    const response = await GET(
      new Request(`https://www.proffera.se/api/public-directory/category-image/${category}`),
      { params: Promise.resolve({ category }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.imageResponse).toHaveBeenCalledTimes(1);

    const [element, options] = mocks.imageResponse.mock.calls[0] ?? [];
    const renderedText = collectRenderedText(element);

    expect(renderedText).toContain(label);
    expect(renderedText.join(" ")).not.toMatch(/[✦⌂↗⚡◌◒◇❋]/u);
    expect(options).toMatchObject({ width: 1200, height: 720 });
  });

  it("keeps the fallback category image contract", async () => {
    await GET(
      new Request("https://www.proffera.se/api/public-directory/category-image/unknown"),
      { params: Promise.resolve({ category: "unknown" }) },
    );

    const [element] = mocks.imageResponse.mock.calls[0] ?? [];
    expect(collectRenderedText(element)).toEqual(expect.arrayContaining(["Tjänsteföretag", "Proffera"]));
  });
});
