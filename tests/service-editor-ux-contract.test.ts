import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/dashboard/installningar/services-read-only.tsx"), "utf8");

describe("service editor UX contract", () => {
  it("keeps the editor grouped around simple customer-facing steps", () => {
    expect(source).toContain("1. Grundinfo");
    expect(source).toContain("2. Pris och område");
    expect(source).toContain("3. Bokningsregler");
    expect(source).toContain("4. Publik sida");
    expect(source).toContain("5. SEO och URL");
    expect(source).toContain("Avancerat");
    expect(source).toContain("Valfritt");
  });

  it("preserves every service write field expected by the server actions", () => {
    for (const field of [
      "name",
      "description",
      "short_description",
      "category",
      "duration_minutes",
      "price_type",
      "price_amount",
      "service_area",
      "buffer_before_minutes",
      "buffer_after_minutes",
      "minimum_notice_minutes",
      "maximum_advance_days",
      "public_status",
      "conversion_mode",
      "cover_image_url",
      "sort_order",
      "public_slug",
      "seo_title",
      "seo_description",
      "is_active",
    ]) {
      expect(source).toContain(`name=\"${field}\"`);
    }
  });

  it("keeps publication and internal activation as separate controls", () => {
    expect(source).toContain('name="public_status"');
    expect(source).toContain('name="is_active"');
    expect(source).toContain("Aktiv tjänst internt");
  });

  it("links service management to business preview and gallery management", () => {
    expect(source).toContain('/dashboard/installningar/foretagssida');
    expect(source).toContain('/dashboard/galleri');
    expect(source).toContain("Förhandsvisa företagssida");
    expect(source).toContain("Hantera bilder");
  });
});
