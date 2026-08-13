import type { Metadata } from "next";
import Link from "next/link";

import { primeViewAreaPages } from "@/lib/primeview-area-pages";
import { primeViewSite } from "@/lib/primeview-seo";

const canonical = `${primeViewSite.origin}/areas`;
const title = "Window Cleaning Service Areas | PrimeView Window Care";
const description = "PrimeView provides window, gutter and exterior cleaning across London and nearby areas. Explore local service information and book online.";

export const metadata: Metadata = {
  metadataBase: new URL(primeViewSite.origin),
  title: { absolute: title },
  description,
  alternates: { canonical },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: canonical, siteName: primeViewSite.name, locale: "en_GB", type: "website", images: [primeViewSite.openGraphImageUrl] },
  twitter: { card: "summary_large_image", title, description, images: [primeViewSite.openGraphImageUrl] },
};

export default function PrimeViewAreasPage() {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonical}#collection`,
    url: canonical,
    name: title,
    description,
    inLanguage: "en-GB",
    isPartOf: { "@id": `${primeViewSite.canonicalUrl}#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: primeViewAreaPages.map((area, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: area.name,
        url: `${primeViewSite.origin}/areas/${area.slug}`,
      })),
    },
  }).replace(/</g, "\\u003c");

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-[#09183a]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="bg-[#06183b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-xl font-black text-white">PrimeView Window Care</Link>
          <Link href="/booking" className="rounded-xl bg-[#0a3c8f] px-4 py-3 text-sm font-black text-white">Book online</Link>
        </div>
      </header>

      <section className="bg-[#06183b] px-5 pb-16 pt-12 text-white">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="text-sm font-semibold text-slate-300"><Link href="/" className="hover:text-white">Home</Link> <span aria-hidden="true">/</span> <span className="text-white">Service Areas</span></nav>
          <h1 className="mt-8 max-w-4xl text-4xl font-black tracking-[-.04em] sm:text-6xl">Window & exterior cleaning service areas</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">PrimeView serves locations across London and nearby areas. Select your area for local service information, or send your postcode if you want us to confirm coverage.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {primeViewAreaPages.map((area) => (
            <article key={area.slug} className="flex flex-col rounded-2xl border border-[#d9e0ed] bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#5271a6]">{area.region}</p>
              <h2 className="mt-2 text-2xl font-black text-[#071b42]">{area.name}</h2>
              <p className="mt-3 flex-1 leading-7 text-slate-600">{area.description}</p>
              <Link href={`/areas/${area.slug}`} className="mt-6 font-black text-[#0a3c8f] underline decoration-2 underline-offset-4">View {area.name} services →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[#d9e0ed] bg-white px-5 py-14">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div><h2 className="text-3xl font-black">Not sure if we cover your postcode?</h2><p className="mt-2 max-w-2xl leading-7 text-slate-600">Send the postcode with your property details and PrimeView will confirm coverage before the appointment.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/services" className="rounded-xl border border-[#a9b9d1] px-5 py-3.5 font-black text-[#0a3c8f]">View services</Link><Link href="/booking" className="rounded-xl bg-[#0a3c8f] px-5 py-3.5 font-black text-white">Book online</Link></div>
        </div>
      </section>
    </main>
  );
}
