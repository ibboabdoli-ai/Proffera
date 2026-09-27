import { describe, expect, it } from "vitest";

import { detectRestaurantImageMime } from "./restaurant-image-type";

describe("restaurant image type detection", () => {
  it("detects supported image signatures without trusting a supplied MIME type", async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]);
    const png = new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ]);
    const webp = new Blob([
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
      ]),
    ]);
    const avif = new Blob([
      new Uint8Array([
        0, 0, 0, 24,
        0x66, 0x74, 0x79, 0x70,
        0x61, 0x76, 0x69, 0x66,
        0, 0, 0, 0,
        0x61, 0x76, 0x69, 0x66,
      ]),
    ]);

    await expect(detectRestaurantImageMime(jpeg)).resolves.toBe("image/jpeg");
    await expect(detectRestaurantImageMime(png)).resolves.toBe("image/png");
    await expect(detectRestaurantImageMime(webp)).resolves.toBe("image/webp");
    await expect(detectRestaurantImageMime(avif)).resolves.toBe("image/avif");
  });

  it("rejects arbitrary bytes", async () => {
    const fake = new Blob([new TextEncoder().encode("<script>alert(1)</script>")]);
    await expect(detectRestaurantImageMime(fake)).resolves.toBeNull();
  });
});
