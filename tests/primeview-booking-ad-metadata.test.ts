import { describe, expect, it } from "vitest";

import { metadata } from "../src/app/primeview-booking/layout";
import { primeViewSite } from "../src/lib/primeview-seo";

describe("PrimeView booking advertising metadata", () => {
  it("keeps the booking route fully on the PrimeView brand", () => {
    const bookingUrl = `${primeViewSite.origin}/booking`;
    const bookingImageUrl = `${primeViewSite.origin}/primeview/services/window-cleaning.webp`;

    expect(metadata.metadataBase).toEqual(new URL(primeViewSite.origin));
    expect(metadata.applicationName).toBe(primeViewSite.name);
    expect(metadata.manifest).toBeNull();
    expect(metadata.icons).toEqual({
      icon: primeViewSite.logoUrl,
      apple: primeViewSite.logoUrl,
    });
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      title: primeViewSite.name,
      statusBarStyle: "black-translucent",
    });
    expect(metadata.keywords).toContain("PrimeView Window Care");
    expect(metadata.keywords).not.toContain("SaaS Sverige");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      locale: "en_GB",
      url: bookingUrl,
      siteName: primeViewSite.name,
      title: "Book Online | PrimeView Window Care",
      images: [{ url: bookingImageUrl }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Book Online | PrimeView Window Care",
      images: [bookingImageUrl],
    });
  });
});
