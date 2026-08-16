import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { MarketingFeatures } from "@/components/marketing/marketing-features";
import { marketingServicePages } from "@/lib/marketing-service-pages";

export const metadata: Metadata = {
  title: {
    absolute: "Funktioner – Företagssida, bokning, CRM och offerter | Proffera",
  },
  description:
    "Se hur Proffera kopplar ihop företagssida, onlinebokning, offertförfrågningar, kund-CRM, uppdrag, omdömen och analys i ett arbetsflöde.",
};

export default function ServicesPage() {
  return (
    <>
      <MarketingFeatures locale="sv" />
      <section className="border-t border-[#e1e7df] bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#17452f]">Fördjupa dig</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a]">Läs mer om de viktigaste delarna i Proffera</h2>
            <p className="mt-3 text-sm leading-7 text-[#5b665f]">Se hur varje del fungerar i ett tjänsteföretags kundresa och vilket problem den är tänkt att lösa.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.values(marketingServicePages).map((page) => (
              <Link key={page.slug} href={`/tjanster/${page.slug}`} className="group rounded-2xl border border-[#dfe5dd] bg-[#fbfcfa] p-5 transition hover:border-[#9fbaa7] hover:bg-[#f4f8f4]">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-black text-[#17201a]">{page.navLabel}</h3>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#17452f] transition group-hover:translate-x-0.5" />
                </div>
                <p className="mt-2 text-sm leading-6 text-[#667168]">{page.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
