import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicBusinessHub: vi.fn(),
  getPublicBusinessService: vi.fn(),
  headers: vi.fn(),
  resolvePublicBusinessUrlContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("not_found"); }) }));
vi.mock("@/lib/public-business-hub", () => ({
  getPublicBusinessHub: mocks.getPublicBusinessHub,
  getPublicBusinessService: mocks.getPublicBusinessService,
  formatPublicBusinessPrice: (service: { priceAmountMinor: number | null; priceLabel: string }, currency: string) => (
    service.priceAmountMinor === null ? service.priceLabel : `${service.priceAmountMinor / 100} ${currency}`
  ),
}));
vi.mock("@/components/public-business/public-contact-form", () => ({
  PublicBusinessContactForm: ({ locale }: { locale: string }) => createElement("form", { "aria-label": `contact-form-${locale}` }),
}));
vi.mock("@/components/public-business/public-quote-form", () => ({
  PublicBusinessQuoteForm: ({ locale }: { locale: string }) => createElement("form", { "aria-label": `quote-form-${locale}` }),
}));
vi.mock("@/components/public-business/public-business-tracking", () => ({
  PublicBusinessTrackedLink: ({
    href,
    eventKey,
    className,
    children,
  }: {
    href: string;
    eventKey: string;
    className?: string;
    children?: ReactNode;
  }) => createElement("a", { href, className, "data-event-key": eventKey }, children),
  PublicBusinessViewEvent: () => null,
}));
vi.mock("@/lib/public-business-seo", () => ({
  resolvePublicBusinessUrlContext: mocks.resolvePublicBusinessUrlContext,
  buildPublicBusinessJsonLd: (business: { companyName: string }) => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.companyName,
  }),
  buildPublicServiceJsonLd: (business: { companyName: string }, service: { name: string }) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    provider: business.companyName,
    name: service.name,
  }),
  serializePublicBusinessJsonLd: (value: unknown) => JSON.stringify(value),
}));

import PublicBusinessPage from "@/app/foretag/[workspace]/page";
import companyStyles from "@/app/foretag/[workspace]/public-business-page.module.css";
import PublicServicePage from "@/app/foretag/[workspace]/tjanster/[service]/page";
import serviceStyles from "@/app/foretag/[workspace]/tjanster/[service]/public-service-page.module.css";

const baseExperience = {
  themeKey: "clean",
  primaryColor: "#0a2e63",
  accentColor: "#1469d8",
  appearance: "light",
  defaultLanguage: "sv",
  swedishEnabled: true,
  englishEnabled: true,
  heroEnabled: true,
  servicesEnabled: true,
  staffEnabled: false,
  reviewsEnabled: true,
  galleryEnabled: true,
  contactEnabled: true,
  faqEnabled: false,
  chatbotEnabled: false,
  logoUrl: "https://cdn.example.test/logo.png",
  heroImageUrl: "https://cdn.example.test/hero.jpg",
  heroVideoUrl: "",
  customDomain: "",
  customDomainStatus: "disconnected",
  themeContentOverrides: {},
};

function hubFixture() {
  return {
    workspace: {
      id: "workspace-1",
      slug: "nordic-fix",
      status: "active",
      bookingSlug: "nordic-fix",
      companyName: "Nordic Fix AB",
      primaryCity: "Stockholm",
      contactEmail: "hej@nordic-fix.test",
      contactPhone: "+4681234567",
      billingCurrency: "SEK",
      businessIntro: "Renovering med tydlig plan och lokal närvaro.",
      bookingEnabled: true,
      experience: { ...baseExperience },
    },
    services: [
      {
        id: "service-1",
        name: "Badrumsrenovering",
        description: "Planering, rivning och färdigställande av badrum.",
        shortDescription: "Komplett badrumsrenovering.",
        category: "Renovering",
        priceLabel: "",
        priceType: "from",
        priceAmountMinor: 250000,
        durationMinutes: 120,
        serviceArea: "Stockholm",
        publicSlug: "badrumsrenovering",
        conversionMode: "book_or_quote",
        coverImageUrl: "https://cdn.example.test/service.jpg",
        seoTitle: "",
        seoDescription: "",
      },
    ],
    reviews: [
      {
        id: "review-1",
        reviewerName: "Anna",
        rating: 5,
        service: "Badrumsrenovering",
        area: "Södermalm",
        message: "Tydlig kommunikation och fint resultat.",
      },
    ],
    gallery: [
      {
        id: "gallery-1",
        mediaType: "image",
        publicUrl: "https://cdn.example.test/gallery.jpg",
        title: "Färdigt badrum",
        caption: "",
        altText: "Färdigt badrum med kakel",
      },
    ],
  };
}

function serviceResultFixture() {
  const hub = hubFixture();
  return { ...hub, service: hub.services[0] };
}

async function renderCompany(locale: "sv" | "en") {
  mocks.getPublicBusinessHub.mockResolvedValue(hubFixture());
  return renderToStaticMarkup(await PublicBusinessPage({
    params: Promise.resolve({ workspace: "nordic-fix" }),
    searchParams: Promise.resolve({ lang: locale }),
  }));
}

async function renderService(locale: "sv" | "en") {
  mocks.getPublicBusinessService.mockResolvedValue(serviceResultFixture());
  return renderToStaticMarkup(await PublicServicePage({
    params: Promise.resolve({ workspace: "nordic-fix", service: "badrumsrenovering" }),
    searchParams: Promise.resolve({ lang: locale }),
  }));
}

describe("public business marketplace visual contract", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.headers.mockResolvedValue(new Headers({ host: "www.proffera.se" }));
    mocks.resolvePublicBusinessUrlContext.mockResolvedValue({
      customDomain: false,
      origin: "https://www.proffera.se",
      companyCanonical: "https://www.proffera.se/foretag/nordic-fix",
      companyHref: "/foretag/nordic-fix",
      serviceCanonical: (serviceSlug: string) => `https://www.proffera.se/foretag/nordic-fix/tjanster/${serviceSlug}`,
      serviceHref: (serviceSlug: string) => `/foretag/nordic-fix/tjanster/${serviceSlug}`,
    });
  });

  it("renders the claimed company page in Swedish with real sections and conversion links", async () => {
    const html = await renderCompany("sv");

    expect(html).toContain('<main lang="sv"');
    expect(html).toContain(`class="${companyStyles.page}"`);
    expect(html).toContain(`class="${companyStyles.serviceList}"`);
    expect(html).toContain('alt="Nordic Fix AB logotyp"');
    expect(html).toContain("Vad kan vi hjälpa dig med?");
    expect(html).toContain("Tidigare arbete");
    expect(html).toContain("Vad kunder säger");
    expect(html).toContain("Redo att ta nästa steg?");
    expect(html).toContain('href="#tjanster"');
    expect(html).toContain('href="#kontakt"');
    expect(html).toContain('href="/foretag/nordic-fix/tjanster/badrumsrenovering?lang=sv"');
    expect(html).toContain('href="/boka/nordic-fix?lang=sv"');
    expect(html).toContain('href="tel:+4681234567"');
    expect(html).toContain('href="mailto:hej@nordic-fix.test"');
    expect(html).toContain('aria-label="contact-form-sv"');
  });

  it("renders the same company contract in English with localized logo text and navigation", async () => {
    const html = await renderCompany("en");

    expect(html).toContain('<main lang="en"');
    expect(html).toContain('alt="Nordic Fix AB logo"');
    expect(html).toContain("How can we help?");
    expect(html).toContain("Previous work");
    expect(html).toContain("What customers say");
    expect(html).toContain("Ready to take the next step?");
    expect(html).toContain('href="/foretag/nordic-fix?lang=sv"');
    expect(html).toContain('href="/foretag/nordic-fix/tjanster/badrumsrenovering?lang=en"');
    expect(html).toContain('href="/boka/nordic-fix?lang=en"');
    expect(html).toContain('aria-label="contact-form-en"');
  });

  it("renders service conversion controls on desktop and the mobile sticky action bar", async () => {
    const sv = await renderService("sv");
    const en = await renderService("en");

    expect(sv).toContain(`class="${serviceStyles.hero}"`);
    expect(sv).toContain("Badrumsrenovering");
    expect(sv).toContain("Om tjänsten");
    expect(sv).toContain('aria-label="quote-form-sv"');
    expect(sv).toContain('href="/boka/nordic-fix?service_id=service-1&amp;lang=sv"');
    expect(sv).toContain('href="#offert"');
    expect(sv.match(/data-event-key="book_clicked"/g)).toHaveLength(2);
    expect(sv.match(/data-event-key="quote_clicked"/g)).toHaveLength(2);
    expect(sv).toContain("fixed inset-x-0 bottom-0 z-40");
    expect(sv).toContain("lg:hidden");

    expect(en).toContain('<main lang="en"');
    expect(en).toContain("About the service");
    expect(en).toContain("Request a quote");
    expect(en).toContain('aria-label="quote-form-en"');
    expect(en).toContain('href="/foretag/nordic-fix/tjanster/badrumsrenovering?lang=sv"');
    expect(en).toContain('href="/boka/nordic-fix?service_id=service-1&amp;lang=en"');
    expect(en).toContain("fixed inset-x-0 bottom-0 z-40");
  });
});
