import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { primeViewAreaPages, primeViewServicePages } from "@/lib/primeview-seo-pages";
import { primeViewSite } from "@/lib/primeview-seo";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...primeViewServicePages, ...primeViewAreaPages].map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = primeViewServicePages.find((item) => item.slug === slug);
  const area = primeViewAreaPages.find((item) => item.slug === slug);

  if (service) {
    const canonical = `${primeViewSite.origin}/services/${service.slug}`;
    const title = `${service.name} in West & North London | PrimeView Window Care`;
    return {
      metadataBase: new URL(primeViewSite.origin),
      title: { absolute: title },
      description: service.description,
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description: service.description,
        url: canonical,
        siteName: primeViewSite.name,
        locale: "en_GB",
        type: "website",
        images: [{ url: primeViewSite.openGraphImageUrl, width: 1200, height: 630, alt: `${service.name} by PrimeView Window Care` }],
      },
      twitter: { card: "summary_large_image", title, description: service.description, images: [primeViewSite.openGraphImageUrl] },
    };
  }

  if (area) {
    const title = `Window Cleaning in ${area.name} | PrimeView Window Care`;
    const canonical = `${primeViewSite.origin}/areas/${area.slug}`;
    return {
      metadataBase: new URL(primeViewSite.origin),
      title: { absolute: title },
      description: area.description,
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description: area.description,
        url: canonical,
        siteName: primeViewSite.name,
        locale: "en_GB",
        type: "website",
        images: [{ url: primeViewSite.openGraphImageUrl, width: 1200, height: 630, alt: `PrimeView Window Care in ${area.name}` }],
      },
      twitter: { card: "summary_large_image", title, description: area.description, images: [primeViewSite.openGraphImageUrl] },
    };
  }

  return {};
}

export default async function PrimeViewSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const service = primeViewServicePages.find((item) => item.slug === slug);
  const area = primeViewAreaPages.find((item) => item.slug === slug);
  if (!service && !area) notFound();

  const title = service ? service.title : `Window & Exterior Cleaning in ${area!.name}`;
  const intro = service ? service.intro : area!.intro;
  const bullets = service ? service.bullets : area!.bullets;
  const faq = service ? service.faq : area!.faq;
  const canonicalPath = service ? `/services/${service.slug}` : `/areas/${area!.slug}`;
  const canonicalUrl = `${primeViewSite.origin}${canonicalPath}`;
  const breadcrumbLabel = service ? service.name : area!.name;
  const serviceName = service?.name ?? `Exterior Cleaning in ${area!.name}`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description: service?.description ?? area!.description,
        inLanguage: "en-GB",
        isPartOf: { "@id": `${primeViewSite.canonicalUrl}#website` },
        about: { "@id": `${canonicalUrl}#service` },
      },
      {
        "@type": "Service",
        "@id": `${canonicalUrl}#service`,
        name: serviceName,
        description: service?.description ?? area!.description,
        url: canonicalUrl,
        provider: { "@id": `${primeViewSite.canonicalUrl}#business` },
        areaServed: area
          ? { "@type": "Place", name: `${area.name}, ${area.region}` }
          : [
              { "@type": "AdministrativeArea", name: "West London" },
              { "@type": "AdministrativeArea", name: "North London" },
            ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: primeViewSite.canonicalUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: service ? "Services" : "Service Areas",
            item: `${primeViewSite.origin}/#${service ? "services" : "areas"}`,
          },
          { "@type": "ListItem", position: 3, name: breadcrumbLabel, item: canonicalUrl },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

  const relatedServices = primeViewServicePages.filter((item) => item.slug !== service?.slug);
  const relatedAreas = primeViewAreaPages.filter((item) => item.slug !== area?.slug);

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-[#09183a]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header className="bg-[#06183b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-xl font-black text-white">PrimeView Window Care</Link>
          <div className="flex items-center gap-2">
            <Link href="/booking" className="hidden rounded-xl border border-white/30 px-4 py-3 text-sm font-black text-white sm:inline-flex">Book online</Link>
            <Link href="/#quote" className="shrink-0 rounded-xl bg-[#0a3c8f] px-4 py-3 text-sm font-black text-white">Free quote</Link>
          </div>
        </div>
      </header>

      <section className="bg-[#06183b] px-5 pb-20 pt-10 text-white">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-300">
            <Link href="/" className="hover:text-white">Home</Link><span aria-hidden="true">/</span>
            <a href={`/#${service ? "services" : "areas"}`} className="hover:text-white">{service ? "Services" : "Service Areas"}</a><span aria-hidden="true">/</span>
            <span className="text-white">{breadcrumbLabel}</span>
          </nav>
          <p className="mt-10 text-sm font-black uppercase tracking-[.16em] text-[#b8ceff]">PrimeView Window Care</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-.04em] sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">{intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/booking" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-[#0a3c8f] px-5 py-4 text-center font-black !text-white" style={{ color: "#ffffff" }}>Book online</Link>
            <Link href="/#quote" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-white px-5 py-4 text-center font-black !text-[#06183b]" style={{ color: "#06183b" }}>Request a free quote</Link>
            <a href={`tel:${primeViewSite.telephone}`} className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/40 px-5 py-4 text-center font-black !text-white" style={{ color: "#ffffff" }}>Call {primeViewSite.telephoneDisplay}</a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-black">What is included</h2>
          <ul className="mt-6 space-y-3">{bullets.map((item) => <li key={item} className="rounded-xl bg-white p-4 shadow-sm">✓ {item}</li>)}</ul>
        </div>
        <div>
          <h2 className="text-3xl font-black">Why choose PrimeView</h2>
          <p className="mt-6 leading-8 text-slate-600">Professional exterior cleaning, clear communication, flexible appointments and careful attention to your property from quotation to completion.</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/gallery" className="font-black text-[#0a3c8f] underline underline-offset-4">View recent work</Link>
            <a href={primeViewSite.googleMapsUrl} target="_blank" rel="noreferrer" className="font-black text-[#0a3c8f] underline underline-offset-4">See PrimeView on Google Maps</a>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d9e0ed] bg-white px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black">Explore our cleaning services</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">Choose a service to see what is included, common questions and how to request a quote.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedServices.map((item) => (
              <Link key={item.slug} href={`/services/${item.slug}`} className="rounded-2xl border border-[#d9e0ed] bg-[#f8faff] p-5 transition hover:border-[#8fa9d8] hover:bg-white">
                <span className="font-black text-[#071b42]">{item.name}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">{item.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-black">Areas we serve</h2>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">PrimeView works across West, North and North West London. Select an area for local service information, or send your postcode if you are nearby.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {relatedAreas.map((item) => (
            <Link key={item.slug} href={`/areas/${item.slug}`} className="rounded-full border border-[#c8d5e8] bg-white px-4 py-2.5 text-sm font-black text-[#0a3c8f] hover:border-[#7798ca]">
              {item.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-3xl font-black">Frequently asked questions</h2>
        <div className="mt-6 grid gap-4">
          {faq.map(([question, answer]) => (
            <details key={question} className="rounded-2xl bg-white p-5 shadow-sm">
              <summary className="cursor-pointer font-black">{question}</summary>
              <p className="mt-3 leading-7 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-[#06183b] px-5 py-14 text-white">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div><h2 className="text-3xl font-black">Ready to get a quote?</h2><p className="mt-2 text-slate-300">Tell PrimeView what needs cleaning and where the property is located.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/booking" className="rounded-xl bg-[#0a3c8f] px-5 py-3.5 font-black text-white">Book online</Link><Link href="/#quote" className="rounded-xl bg-white px-5 py-3.5 font-black text-[#06183b]">Free quote</Link></div>
        </div>
      </section>
    </main>
  );
}
