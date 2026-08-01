import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Portfolio | Proffera",
  description: "Utvalda kundprojekt byggda och levererade med Proffera.",
};

const projects = [
  {
    name: "PrimeView Window Care",
    location: "West & North London, United Kingdom",
    category: "Hemsida, bokningsflöde och kundhantering",
    description:
      "En komplett digital närvaro för ett brittiskt fönster- och exteriörvårdsföretag, med responsiv webbplats, offertflöde, SEO, domänkoppling och Proffera-workspace.",
    href: "/portfolio/primeview",
    liveUrl: "https://www.primeviewwindowcare.co.uk",
  },
] as const;

export default function PortfolioPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#17201a]">
      <section className="border-b border-[#dfe5dd] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#17452f]">Portfolio</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-[-0.04em] sm:text-6xl">
            Levererade kundprojekt med verkliga resultat.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5b665f]">
            Här visas företag som har fått webbplats, bokningsflöde och digital arbetsyta byggd med Proffera.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {projects.map((project) => (
            <article key={project.name} className="overflow-hidden rounded-[1.75rem] border border-[#dfe5dd] bg-white shadow-sm">
              <div className="bg-[linear-gradient(135deg,#061b40_0%,#102d68_58%,#d8ad42_180%)] p-8 text-white sm:p-10">
                <p className="text-sm font-semibold text-[#f2d885]">Delivered project</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">{project.name}</h2>
                <p className="mt-2 text-sm text-slate-200">{project.location}</p>
              </div>
              <div className="p-8 sm:p-10">
                <p className="text-sm font-semibold text-[#17452f]">{project.category}</p>
                <p className="mt-4 leading-7 text-[#5b665f]">{project.description}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href={project.href} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#17452f] px-5 py-3 font-semibold text-white transition hover:bg-[#103623]">
                    Visa case study <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a href={project.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cfd8d1] px-5 py-3 font-semibold text-[#17201a] transition hover:bg-[#f7f7f4]">
                    Besök webbplatsen <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
