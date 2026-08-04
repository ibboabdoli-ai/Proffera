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
    return { title: service.title, description: service.description, alternates: { canonical }, openGraph: { title: service.title, description: service.description, url: canonical, type: "website" } };
  }

  if (area) {
    const title = `Window & Exterior Cleaning in ${area.name} | PrimeView`;
    const description = `Professional window, gutter, conservatory, fascia, solar panel and patio cleaning in ${area.name} and nearby ${area.region} areas.`;
    const canonical = `${primeViewSite.origin}/areas/${area.slug}`;
    return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: "website" } };
  }

  return {};
}

export default async function PrimeViewSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const service = primeViewServicePages.find((item) => item.slug === slug);
  const area = primeViewAreaPages.find((item) => item.slug === slug);
  if (!service && !area) notFound();

  const title = service ? service.title : `Window & Exterior Cleaning in ${area!.name}`;
  const intro = service ? service.intro : `PrimeView Window Care serves homes and businesses across ${area!.name} and nearby ${area!.region} areas. We provide reliable exterior cleaning with clear communication and free, no-obligation quotes.`;
  const bullets = service ? service.bullets : ["Window cleaning", "Gutter and downpipe cleaning", "Conservatory, fascia and soffit cleaning", "Solar panel, driveway and patio cleaning"];
  const faq = service ? service.faq : [[`Do you cover all of ${area!.name}?`, `We serve ${area!.name} and nearby areas, subject to scheduling and access.`], ["Can I request several services together?", "Yes. Multiple exterior-cleaning services can be included in one quotation."], ["How do I get a quote?", "Use the online quote form, call or message PrimeView with your address and the services required."]] as const;
  const canonical = service ? `/services/${service.slug}` : `/areas/${area!.slug}`;
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "Service", name: title, provider: { "@type": "ProfessionalService", name: primeViewSite.name, url: primeViewSite.canonicalUrl, telephone: primeViewSite.telephone }, areaServed: area?.name ?? ["West London", "North London"], url: `${primeViewSite.origin}${canonical}` }).replace(/</g, "\\u003c");

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-[#09183a]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="bg-[#06183b] text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5"><Link href="/" className="text-xl font-black text-white">PrimeView Window Care</Link><Link href="/#quote" className="shrink-0 rounded-xl bg-[#0a3c8f] px-4 py-3 text-sm font-black text-white">Free quote</Link></div></header>
      <section className="bg-[#06183b] px-5 pb-20 pt-14 text-white"><div className="mx-auto max-w-6xl"><p className="text-sm font-black uppercase tracking-[.16em] text-[#b8ceff]">PrimeView Window Care</p><h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-.04em] sm:text-6xl">{title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">{intro}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/#quote" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-white px-5 py-4 text-center font-black !text-[#06183b]" style={{ color: "#06183b" }}>Request a free quote</Link><a href={`tel:${primeViewSite.telephone}`} className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/40 px-5 py-4 text-center font-black !text-white" style={{ color: "#ffffff" }}>Call {primeViewSite.telephoneDisplay}</a></div></div></section>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-2"><div><h2 className="text-3xl font-black">What is included</h2><ul className="mt-6 space-y-3">{bullets.map((item) => <li key={item} className="rounded-xl bg-white p-4 shadow-sm">✓ {item}</li>)}</ul></div><div><h2 className="text-3xl font-black">Why choose PrimeView</h2><p className="mt-6 leading-8 text-slate-600">Professional exterior cleaning, clear communication, flexible appointments and careful attention to your property from quotation to completion.</p><Link href="/gallery" className="mt-6 inline-block font-black text-[#0a3c8f] underline underline-offset-4">View recent work</Link></div></section>
      <section className="mx-auto max-w-6xl px-5 pb-20"><h2 className="text-3xl font-black">Frequently asked questions</h2><div className="mt-6 grid gap-4">{faq.map(([question, answer]) => <details key={question} className="rounded-2xl bg-white p-5 shadow-sm"><summary className="cursor-pointer font-black">{question}</summary><p className="mt-3 leading-7 text-slate-600">{answer}</p></details>)}</div></section>
    </main>
  );
}
