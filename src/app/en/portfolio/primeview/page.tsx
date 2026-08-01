import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "PrimeView Window Care | Proffera Portfolio",
  description: "Case study: website, SEO, quote flow and Proffera workspace for PrimeView Window Care in London.",
};

const delivered = [
  "Responsive website for mobile and desktop",
  "Clear service structure for six exterior-cleaning services",
  "Quote and contact flow",
  "SEO foundation, metadata and domain configuration",
  "New production domain and redirect from the previous domain",
  "Dedicated Proffera workspace for customer and booking management",
  "Gallery and review support",
] as const;

export default function EnglishPrimeViewPortfolioPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#17201a]">
      <section className="bg-[linear-gradient(135deg,#061b40_0%,#102d68_62%,#173f83_100%)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <Link href="/en/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to portfolio
          </Link>
          <p className="mt-12 text-sm font-bold uppercase tracking-[0.16em] text-[#e4c45f]">Delivered client project</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-black tracking-[-0.05em] sm:text-7xl">PrimeView Window Care</h1>
          <p className="mt-5 text-lg text-slate-200">West & North London, United Kingdom</p>
          <div className="mt-10">
            <a href="https://www.primeviewwindowcare.co.uk" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#d8ad42] px-6 py-4 font-bold text-white shadow-lg transition hover:-translate-y-0.5">
              Visit the live website <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-24">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#17452f]">The brief</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">From a local service business to a professional digital presence.</h2>
        </div>
        <div className="space-y-5 text-lg leading-8 text-[#5b665f]">
          <p>
            PrimeView Window Care needed a modern website that clearly presented its services, service area and contact options. The project covered design, implementation and technical launch.
          </p>
          <p>
            The solution was built within the Proffera ecosystem and connected to the company&apos;s own domain. Visitors can quickly understand the offer, contact the business and request a quote from mobile or desktop.
          </p>
        </div>
      </section>

      <section className="border-y border-[#dfe5dd] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#17452f]">Delivered</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {delivered.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#17452f]" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-3">
          <article className="rounded-2xl border border-[#dfe5dd] bg-white p-7">
            <p className="text-sm font-semibold text-[#17452f]">Platform</p>
            <h2 className="mt-3 text-2xl font-bold">Proffera</h2>
            <p className="mt-3 leading-7 text-[#5b665f]">Website, workspace, booking and customer flows within one ecosystem.</p>
          </article>
          <article className="rounded-2xl border border-[#dfe5dd] bg-white p-7">
            <p className="text-sm font-semibold text-[#17452f]">Market</p>
            <h2 className="mt-3 text-2xl font-bold">United Kingdom</h2>
            <p className="mt-3 leading-7 text-[#5b665f]">An English-language delivery tailored to local customers across West and North London.</p>
          </article>
          <article className="rounded-2xl border border-[#dfe5dd] bg-white p-7">
            <p className="text-sm font-semibold text-[#17452f]">Status</p>
            <h2 className="mt-3 text-2xl font-bold">Live & delivered</h2>
            <p className="mt-3 leading-7 text-[#5b665f]">Deployed on the client&apos;s production domain and published as a delivered client project.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
