import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  emptyRestaurantSite,
  restaurantSiteSchema,
  validateRestaurantSite,
  type RestaurantSite,
} from "@/lib/restaurant-site-schema";

const firstId = "95022059-a7ab-41de-9abe-a987ed78bef1";
const secondId = "5a913e72-314e-46fe-8df1-8e49eb3f7a67";

function photo(
  id: string,
  sortOrder: number,
): RestaurantSite["media"]["gallery"][number] {
  return {
    id,
    alt: { sv: "Restaurangen", en: "Restaurant" },
    kind: "interior",
    sortOrder,
  };
}

// This is a source-level React identity contract, not a browser-runtime test.
describe("restaurant editor identity wiring", () => {
  it("keys the detailed price input by the selected dish rather than reusing its raw state", () => {
    const source = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );
    expect(source).toContain("const [priceInputEpoch, setPriceInputEpoch] = useState(0)");
    expect(source).toContain("setPriceInputEpoch((current) => current + 1)");
    expect(source).toContain("key={`${priceInputEpoch}:${dish.id}`}");
    expect(source).toContain("key={`${priceInputEpoch}:${item.id}`}");
  });
});

describe("restaurant gallery identity validation", () => {
  it("accepts distinct photos even when storage order differs from display order", () => {
    const site = structuredClone(emptyRestaurantSite);
    site.media.gallery = [photo(firstId, 4), photo(secondId, 0)];
    expect(validateRestaurantSite(site).ok).toBe(true);
  });

  it("rejects repeated media IDs even when the captions and kinds differ", () => {
    const site = structuredClone(emptyRestaurantSite);
    site.media.gallery = [
      photo(firstId, 0),
      {
        ...photo(firstId, 1),
        kind: "exterior",
        alt: { sv: "Annan beskrivning", en: "Another caption" },
      },
    ];
    expect(restaurantSiteSchema.safeParse(site).success).toBe(false);
    expect(validateRestaurantSite(site).ok).toBe(false);
  });

  it("rejects replacement of a photo with another photo already in the gallery", () => {
    const site = structuredClone(emptyRestaurantSite);
    site.media.gallery = [photo(firstId, 0), photo(secondId, 1)];
    site.media.gallery[1].id = firstId;
    expect(validateRestaurantSite(site).ok).toBe(false);
  });

  it("still allows the hero to reuse one gallery photo", () => {
    const site = structuredClone(emptyRestaurantSite);
    site.media.gallery = [photo(firstId, 0)];
    site.media.hero = { id: firstId, alt: { sv: "Restaurangen", en: "Restaurant" } };
    expect(validateRestaurantSite(site).ok).toBe(true);
  });

  it("keeps an empty gallery valid", () => {
    expect(validateRestaurantSite(structuredClone(emptyRestaurantSite)).ok).toBe(true);
  });
});
