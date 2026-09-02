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
    ["stadning", "Städning", "Städning & lokalvård"],
    ["hemservice", "Hemservice", "Konsumenttjänster i hemmet"],
    ["flytt", "Flytt", "Flyttjänster"],
    ["elektriker", "Elektriker", "Elinstallationer"],
    ["vvs", "VVS", "Värme & sanitet"],
    ["maleri", "Måleri", "Måleriarbeten"],
    ["snickeri", "Snickeri", "Byggnadssnickeri"],
    ["tradgard", "Trädgård", "Skötsel av grönytor"],
  ])("renders %s without dynamic fallback-font glyphs", async (category, label, detail) => {
    const response = await GET(
      new Request(`https://www.proffera.se/api/public-directory/category-image/${category}`),
      { params: Promise.resolve({ category }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.imageResponse).toHaveBeenCalledTimes(1);

    const [element, options] = mocks.imageResponse.mock.calls[0] ?? [];
    const renderedText = collectRenderedText(element);

    expect(renderedText).toContain(label);
    expect(renderedText).toContain(detail);
    expect(renderedText.join(" ")).not.toMatch(/[✦⌂↗⚡◌◒◇❋]/u);
    expect(options).toMatchObject({ width: 1200, height: 720 });
  });

  it.each(["unknown", "constructor", "toString", "__proto__"])(
    "keeps the fallback category image contract for %s",
    async (category) => {
      await GET(
        new Request(`https://www.proffera.se/api/public-directory/category-image/${category}`),
        { params: Promise.resolve({ category }) },
      );

      const [element] = mocks.imageResponse.mock.calls[0] ?? [];
      expect(collectRenderedText(element)).toEqual(expect.arrayContaining(["Tjänsteföretag", "Proffera"]));
    },
  );
});
