export const primeViewSite = {
  name: "PrimeView Window Care",
  alternateName: "PrimeView",
  origin: "https://www.primeviewwindowcare.co.uk",
  canonicalUrl: "https://www.primeviewwindowcare.co.uk/",
  galleryUrl: "https://www.primeviewwindowcare.co.uk/gallery",
  googleMapsUrl:
    "https://www.google.com/maps/place/PrimeView+Window+Care/@51.5665682,-0.4737333,11z/data=!4m8!3m7!1s0x893cb4b7e3dcc37b:0x47fd0c4bc2acaa07!8m2!3d51.5664702!4d-0.308927!9m1!1b1!16s%2Fg%2F11zh9kb89p",
  title: "Window, Gutter & Exterior Cleaning in West & North London | PrimeView",
  description:
    "Professional window, gutter, pressure washing and exterior cleaning for homes and businesses across West and North London. Request a free, no-obligation quote from PrimeView Window Care.",
  telephone: "+447500338585",
  telephoneDisplay: "07500 338 585",
  email: "am@primeviewlondon.co.uk",
  logoUrl: "https://www.primeviewwindowcare.co.uk/brand/primeview-window-care-logo.jpeg",
  openGraphImageUrl: "https://www.primeviewwindowcare.co.uk/brand/primeview-window-care-logo.jpeg?v=2",
} as const;

export const primeViewServices = [
  {
    title: "Window Cleaning",
    description: "Streak-free windows for homes, shops and business premises, finished with care.",
  },
  {
    title: "Fascia & Gutter Cleaning",
    description: "Fascia and gutter cleaning with simple property-based starting prices.",
  },
  {
    title: "Conservatory Roof Cleaning",
    description: "Restore light and clarity to conservatory roofs, glass and surrounding frames.",
  },
  {
    title: "Gutter Cleaning",
    description: "Clear gutters and downpipes to help protect your home from overflowing rainwater.",
  },
  {
    title: "Pressure Washing",
    description: "Pressure washing for driveways, patios, paths and outdoor areas that need a fresh start.",
  },
  {
    title: "Solar Panel Cleaning",
    description: "A safe, specialist clean that helps keep your solar panels performing well.",
  },
] as const;

export const primeViewStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${primeViewSite.canonicalUrl}#website`,
      name: primeViewSite.name,
      alternateName: primeViewSite.alternateName,
      url: primeViewSite.canonicalUrl,
      inLanguage: "en-GB",
      publisher: { "@id": `${primeViewSite.canonicalUrl}#business` },
    },
    {
      "@type": "WebPage",
      "@id": `${primeViewSite.canonicalUrl}#webpage`,
      url: primeViewSite.canonicalUrl,
      name: primeViewSite.title,
      description: primeViewSite.description,
      inLanguage: "en-GB",
      isPartOf: { "@id": `${primeViewSite.canonicalUrl}#website` },
      about: { "@id": `${primeViewSite.canonicalUrl}#business` },
    },
    {
      "@type": "ProfessionalService",
      "@id": `${primeViewSite.canonicalUrl}#business`,
      name: primeViewSite.name,
      alternateName: primeViewSite.alternateName,
      description: primeViewSite.description,
      url: primeViewSite.canonicalUrl,
      logo: primeViewSite.logoUrl,
      image: primeViewSite.logoUrl,
      telephone: primeViewSite.telephone,
      email: primeViewSite.email,
      priceRange: "££",
      sameAs: [primeViewSite.googleMapsUrl],
      areaServed: [
        { "@type": "AdministrativeArea", name: "West London" },
        { "@type": "AdministrativeArea", name: "North London" },
      ],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: primeViewSite.telephone,
        email: primeViewSite.email,
        contactType: "customer service",
        areaServed: "GB",
        availableLanguage: "English",
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Exterior cleaning services",
        itemListElement: primeViewServices.map((service) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: service.title,
            description: service.description,
            areaServed: ["West London", "North London"],
            provider: { "@id": `${primeViewSite.canonicalUrl}#business` },
          },
        })),
      },
    },
  ],
} as const;
