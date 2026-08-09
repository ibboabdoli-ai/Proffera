import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public booking media guard", () => {
  it("removes failed hero images and videos after a load error", () => {
    const guard = source("src/app/boka/[slug]/booking-media-guard.tsx");
    const layout = source("src/app/boka/[slug]/layout.tsx");

    expect(guard).toContain('document.addEventListener("error", hideFailedMedia, true)');
    expect(guard).toContain('target.style.display = "none"');
    expect(guard).toContain('[data-booking-theme] > main:first-child > section:first-child');
    expect(layout).toContain('import { BookingMediaGuard } from "./booking-media-guard"');
    expect(layout).toContain("<BookingMediaGuard />");
  });
});
