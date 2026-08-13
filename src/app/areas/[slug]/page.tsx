import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { primeViewAreaPages } from "@/lib/primeview-area-pages";
import { primeViewServicePages } from "@/lib/primeview-seo-pages";
import { primeViewSite } from "@/lib/primeview-seo";

type PageProps = { params: Promise<{ slug: string }> };

const whiteCtaText = { color: "#ffffff", WebkitTextFillColor: "#ffffff" } as const;
const darkCtaText = { color: "#06183b", WebkitTextFillColor: "#06183b" } as const;

export function generateStaticParams() {
  return primeViewAreaPages.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = primeViewAreaPages.find((item) => item.slug === slug);
  if (!area) return {};

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

export default async function PrimeViewAreaPage({ params }: PageProps) {
  const { slug } = await params;
  const area = primeViewAreaPages.find((item) => item.slug === slug);
  if (!area) notFound();

  const canonicalUrl = `${primeViewSite.origin}/areas/${area.slug}`;
  const relatedAreas = primeViewAreaPages.filter((item) => item.slug !== area.slug).slice(0, 12);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: `Window & Exterior Cleaning in ${area.name}`,
        description: area.description,
        inLanguage: "en-GB",
        isPartOf: { "@id": `${primeViewSite.canonicalUrl}#website` },
      },
      {
        "@type": "Service",
        "@id": `${canonicalUrl}#service`,
        name: `Exterior Cleaning in ${area.name}`,
        description: area.description,
        url: canonicalUrl,
        provider: { "@id": `${primeViewSite.canonicalUrl}#business` },
        areaServed: { "@type": "Place", name: `${area.name}, ${area.region}` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: primeViewSite.canonicalUrl },
          { "@type": "ListItem", position: 2, name: "Service Areas", item: `${primeViewSite.origin}/areas` },
          { "@type": "ListItem", position: 3, name: area.name, item: canonicalUrl },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-[#09183a]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header className="bg-[#06183b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-xl font-black text-white" style={whiteCtaText}>PrimeView Window Care</Link>
          <div className="flex items-center gap-2">
            <Link href="/booking" className="hidden rounded-xl border border-white/30 px-4 py-3 text-sm font-black text-white sm:inline-flex" style={whiteCtaText}>Book online</Link>
            <Link href="/#quote" className="shrink-0 rounded-xl bg-[#0a3c8f] px-4 py-3 text-sm font-black text-white" style={whiteCtaText}>Free quote</Link>
          </div>
        </div>
      </header>

      <section className="bg-[#06183b] px-5 pb-20 pt-10 text-white">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-300">
            <Link href="/" className="hover:text-white">Home</Link><span aria-hidden="true">/</span>
            <Link href="/areas" className="hover:text-white">Service Areas</Link><span aria-hidden="true">/</span>
            <span className="text-white">{area.name}</span>
          </nav>
          <p className="mt-10 text-sm font-black uppercase tracking-[.16em] text-[#b8ceff]">PrimeView Window Care</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-.04em] sm:text-6xl">Window & Exterior Cleaning in {area.name}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">{area.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/booking" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-[#0a3c8f] px-5 py-4 text-center font-black !text-white" style={whiteCtaText}>Book online</Link>
            <Link href="/#quote" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-white px-5 py-4 text-center font-black !text-[#06183b]" style={darkCtaText}>Request a free quote</Link>
            <a href={`tel:${primeViewSite.telephone}`} className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/40 px-5 py-4 text-center font-black !text-white" style={whiteCtaText}>Call {primeViewSite.telephoneDisplay}</a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-black">What is included</h2>
          <ul className="mt-6 space-y-3">{area.bullets.map((item) => <li key={item} className="rounded-xl bg-white p-4 shadow-sm">✓ {item}</li>)}</ul>
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
          <h2 className="text-3xl font-black">Cleaning services in {area.name}</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {primeViewServicePages.map((item) => (
              <Link key={item.slug} href={`/services/${item.slug}`} className="rounded-2xl border border-[#d9e0ed] bg-[#f8faff] p-5 transition hover:border-[#8fa9d8] hover:bg-white">
                <span className="font-black text-[#071b42]">{item.name}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">{item.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex items-end justify-between gap-4">
          <div><h2 className="text-3xl font-black">Other areas we serve</h2><p className="mt-3 max-w-3xl leading-7 text-slate-600">PrimeView serves many locations across London and nearby areas.</p></div>
          <Link href="/areas" className="hidden font-black text-[#0a3c8f] underline underline-offset-4 sm:inline">View all areas</Link>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          {relatedAreas.map((item) => <Link key={item.slug} href={`/areas/${item.slug}`} className="rounded-full border border-[#c8d5e8] bg-white px-4 py-2.5 text-sm font-black text-[#0a3c8f] hover:border-[#7798ca]">{item.name}</Link>)}
        </div>
        <Link href="/areas" className="mt-6 inline-block font-black text-[#0a3c8f] underline underline-offset-4 sm:hidden">View all areas</Link>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-3xl font-black">Frequently asked questions</h2>
        <div className="mt-6 grid gap-4">
          {area.faq.map(([question, answer]) => (
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
          <div className="flex flex-wrap gap-3"><Link href="/booking" className="rounded-xl bg-[#0a3c8f] px-5 py-3.5 font-black text-white" style={whiteCtaText}>Book online</Link><Link href="/#quote" className="rounded-xl bg-white px-5 py-3.5 font-black text-[#06183b]" style={darkCtaText}>Free quote</Link></div>
        </div>
      </section>
    </main>
  );
}
