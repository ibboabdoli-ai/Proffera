import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Public workspace gallery", () => {
  it("provides workspace-scoped Swedish and English public routes", () => {
    const page = source("src/app/galleri/[slug]/page.tsx");
    const alias = source("src/app/gallery/[slug]/page.tsx");

    expect(page).toContain("w.slug = ${slug} or w.public_booking_slug = ${slug}");
    expect(page).toContain("getPublishedGalleryItems(String(workspace.slug))");
    expect(page).toContain("experience.galleryEnabled");
    expect(alias).toContain("@/app/galleri/[slug]/page");
  });

  it("shows only published workspace media on the booking surface", () => {
    const layout = source("src/app/boka/[slug]/layout.tsx");
    const galleryDb = source("src/lib/website-gallery-db.ts");

    expect(layout).toContain("experience.galleryEnabled");
    expect(layout).toContain("PublicWorkspaceGallery");
    expect(galleryDb).toContain("g.status='published'");
    expect(galleryDb).toContain("w.slug=${workspaceSlug}");
  });
});

describe("Booking theme system", () => {
  it("offers five visual one-click presets", () => {
    const layout = source("src/app/dashboard/installningar/utseende/layout.tsx");

    for (const key of ["clean", "salon", "premium", "modern", "minimal"]) {
      expect(layout).toContain(`key: "${key}"`);
    }
    expect(layout).toContain("applyThemePreset");
    expect(layout).toContain("Öppna bokningssidans förhandsvisning");
  });

  it("applies distinct runtime theme attributes and CSS contracts", () => {
    const layout = source("src/app/boka/[slug]/layout.tsx");
    const css = source("src/app/boka/[slug]/booking-themes.css");

    expect(layout).toContain("data-booking-theme={themeKey}");
    for (const key of ["clean", "salon", "premium", "modern", "minimal"]) {
      expect(css).toContain(`[data-booking-theme=\"${key}\"]`);
    }
    expect(css).toContain("text-transform: uppercase");
    expect(css).toContain("border-radius: 999px");
  });
});
