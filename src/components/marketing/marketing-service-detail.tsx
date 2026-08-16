import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button-link";
import { marketingServicePages, type MarketingServiceSlug } from "@/lib/marketing-service-pages";

export function MarketingServiceDetail({ slug }: { slug: MarketingServiceSlug }) {
  const page = marketingServicePages[slug];
  const related = Object.values(marketingServicePages).filter((item) => item.slug !== slug);

  return (
    <div className="overflow-hidden bg-[#f6f8f4]">
      <section className="border-b border-[#e1e7df] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#667168]">
            <Link href="/tjanster" className="transition hover:text-[#17452f]">Funktioner</Link>
            <span aria-hidden="true">/</span>
            <span className="text-[#17452f]">{page.navLabel}</span>
          </div>
          <p className="mt-8 text-sm font-black uppercase tracking-[0.16em] text-[#17452f]">{page.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-[#17201a] sm:text-5xl lg:text-6xl">{page.heading}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5b665f]">{page.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/skapa-konto">Starta gratis i 14 dagar</ButtonLink>
            <ButtonLink href="/priser" variant="secondary">Se priser</ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#2f6b4b]">Varför</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a]">{page.problemTitle}</h2>
          </div>
          <div className="grid gap-3">
            {page.problems.map((problem) => (
              <div key={problem} className="flex gap-3 rounded-2xl border border-[#dfe5dd] bg-white p-5 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2f7b53]" />
                <p className="text-sm leading-7 text-[#526057]">{problem}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#e1e7df] bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="max-w-3xl text-3xl font-black tracking-[-0.03em] text-[#17201a]">{page.flowTitle}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {page.flow.map((step) => (
              <article key={step.title} className="rounded-3xl border border-[#dfe5dd] bg-[#fbfcfa] p-5">
                <h3 className="font-black text-[#17452f]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#667168]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-3xl font-black tracking-[-0.03em] text-[#17201a]">{page.featuresTitle}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {page.features.map((feature) => (
            <article key={feature.title} className="rounded-3xl border border-[#dfe5dd] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-black text-[#17201a]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[#667168]">{feature.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-[2rem] bg-[#102a1c] p-7 text-white sm:p-9">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-white/60">Passar för</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{page.audienceTitle}</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">{page.audience}</p>
        </div>
      </section>

      <section className="border-y border-[#e1e7df] bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:px-8">
          <h2 className="text-3xl font-black tracking-tight text-[#17201a]">Vanliga frågor</h2>
          <div className="grid gap-3">
            {page.faq.map((item) => (
              <article key={item.question} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfcfa] p-5">
                <h3 className="font-black text-[#17201a]">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-[#5b665f]">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-black tracking-tight text-[#17201a]">Fler delar av kundflödet</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {related.map((item) => (
            <Link key={item.slug} href={`/tjanster/${item.slug}`} className="group flex items-center justify-between rounded-2xl border border-[#dfe5dd] bg-white px-5 py-4 font-bold text-[#344139] transition hover:border-[#9fbaa7] hover:text-[#17452f]">
              {item.navLabel}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-[#dce5db] bg-[#eef5ef] p-7 sm:flex-row sm:items-center sm:p-9">
          <div>
            <h2 className="text-2xl font-black text-[#17201a]">Prova Proffera med ditt eget kundflöde</h2>
            <p className="mt-2 text-sm leading-7 text-[#5b665f]">Starter och Professional kan provas gratis i 14 dagar utan betalning vid start.</p>
          </div>
          <ButtonLink href="/skapa-konto" className="shrink-0">Starta gratis</ButtonLink>
        </div>
      </section>
    </div>
  );
}
