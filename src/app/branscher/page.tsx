import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { MarketingIndustries } from "@/components/marketing/marketing-industries";
import { marketingIndustryPages } from "@/lib/marketing-industry-pages";

export const metadata: Metadata = {
  title: {
    absolute: "Branscher – Proffera för tjänsteföretag",
  },
  description:
    "Proffera passar tjänsteföretag som behöver onlinebokning, offertförfrågningar, kund-CRM, uppdrag och uppföljning – från städning och salong till teknisk service.",
};

export default function IndustriesPage() {
  return (
    <>
      <MarketingIndustries locale="sv" />
      <section className="border-t border-[#e1e7df] bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#17452f]">Branschguider</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a]">Se hur Proffera passar olika tjänsteföretag</h2>
            <p className="mt-3 text-sm leading-7 text-[#5b665f]">Varje guide fokuserar på det kundflöde som är mest relevant för branschen – utan att skapa en separat produktversion.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.values(marketingIndustryPages).map((page) => (
              <Link key={page.slug} href={`/branscher/${page.slug}`} className="group rounded-2xl border border-[#dfe5dd] bg-[#fbfcfa] p-5 transition hover:border-[#9fbaa7] hover:bg-[#f4f8f4]">
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
