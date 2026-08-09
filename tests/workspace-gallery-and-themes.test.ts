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
    expect(page).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "media_gallery")');
    expect(page).not.toContain("from workspace_plans wp");
    expect(alias).toContain("@/app/galleri/[slug]/page");
  });

  it("renders a useful standalone state before the first media item is published", () => {
    const page = source("src/app/galleri/[slug]/page.tsx");

    expect(page).toContain("if (!items.length)");
    expect(page).toContain("Galleriet är klart");
    expect(page).toContain("Publicerade medier visas här automatiskt");
  });

  it("shows only published workspace media when the canonical gallery feature is available", () => {
    const layout = source("src/app/boka/[slug]/layout.tsx");
    const galleryDb = source("src/lib/website-gallery-db.ts");

    expect(layout).toContain("experience.galleryEnabled");
    expect(layout).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "media_gallery")');
    expect(layout).not.toContain("from workspace_plans wp");
    expect(layout).toContain("PublicWorkspaceGallery");
    expect(galleryDb).toContain("g.status='published'");
    expect(galleryDb).toContain("w.slug=${workspaceSlug}");
  });
});

describe("Booking theme system", () => {
  it("offers six visual one-click presets from one canonical builder", () => {
    const appearanceLayout = source("src/app/dashboard/installningar/utseende/layout.tsx");
    const builder = source("src/app/dashboard/installningar/utseende/booking-page-builder.tsx");
    const experience = source("src/lib/workspace-experience.ts");

    expect(appearanceLayout).not.toContain("Färdiga bokningsteman");
    expect(appearanceLayout).not.toContain("applyThemePreset");

    for (const key of ["clean", "salon", "premium", "modern", "minimal", "restaurant"]) {
      expect(builder).toContain(`key: "${key}"`);
      expect(experience).toContain(`"${key}"`);
    }
    expect(builder).toContain("applyTemplate");
    expect(builder).toContain("Live design preview");
    expect(builder).toContain("Öppna bokningssidan");
  });

  it("applies distinct runtime theme attributes and CSS contracts", () => {
    const layout = source("src/app/boka/[slug]/layout.tsx");
    const css = source("src/app/boka/[slug]/booking-themes.css");

    expect(layout).toContain("data-booking-theme={themeKey}");
    expect(layout).toContain("data-booking-appearance={appearance}");
    for (const key of ["clean", "salon", "premium", "modern", "minimal", "restaurant"]) {
      expect(css).toContain(`[data-booking-theme="${key}"]`);
    }
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("data-booking-form");
    expect(css).toContain("border-radius: 999px");
  });
});
