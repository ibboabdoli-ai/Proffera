import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Languages, MapPin, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { getClaimedDirectoryWorkspaceSlug } from "@/lib/company-directory-routing";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const categoryLabels: Record<string, string> = {
  stadning: "Städning",
  flytt: "Flytt",
  elektriker: "Elektriker",
  vvs: "VVS",
  maleri: "Måleri",
  snickeri: "Snickeri",
  tradgard: "Trädgård",
};

function absoluteUrl(value: string) {
  return new URL(value, siteConfig.url).toString();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicDirectoryBusiness(slug);
  if (!business) return {};
  const category = categoryLabels[business.categorySlug] ?? business.primarySniLabel ?? "Tjänster";
  const description = business.activityDescription || `${business.companyName} i ${business.city} – ${category}.`;
  const swedishPath = `/foretag/listad/${encodeURIComponent(business.slug)}`;
  const englishPath = `/en/companies/${encodeURIComponent(business.slug)}`;
  const canonical = `${siteConfig.url}${swedishPath}`;
  const hasActualBusinessMedia = Boolean(business.media?.isActualBusinessMedia && business.media.url);
  return {
    title: `${business.companyName} | Proffera`,
    description,
    alternates: {
      canonical,
      languages: {
        "sv-SE": swedishPath,
        en: englishPath,
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: business.companyName,
      description,
      url: canonical,
      type: "website",
      ...(hasActualBusinessMedia ? {
        images: [{
          url: absoluteUrl(business.media!.url),
          alt: business.companyName,
        }],
      } : {}),
    },
  };
}

export default async function ListedBusinessPage({ params }: Props) {
  const { slug } = await params;
  const business = await getPublicDirectoryBusiness(slug);
  if (!business) {
    const workspaceSlug = await getClaimedDirectoryWorkspaceSlug(slug);
    if (workspaceSlug) redirect(`/foretag/${encodeURIComponent(workspaceSlug)}`);
    notFound();
  }

  const category = categoryLabels[business.categorySlug] ?? business.primarySniLabel ?? "Tjänsteföretag";
  const location = [business.postalCode, business.city].filter(Boolean).join(" ");
  const lastChecked = business.lastCheckedAt
    ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeZone: "Europe/Stockholm" }).format(new Date(business.lastCheckedAt))
    : "kontrollerad vid senaste synk";
  const canonical = `${siteConfig.url}/foretag/listad/${encodeURIComponent(business.slug)}`;
  const description = business.activityDescription || `${business.companyName} i ${business.city} – ${category}.`;
  const hasActualBusinessMedia = Boolean(business.media?.isActualBusinessMedia && business.media.url);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.companyName,
    url: canonical,
    description,
    category,
    ...(business.city || business.addressLine1 || business.postalCode ? {
      address: {
        "@type": "PostalAddress",
        ...(business.addressLine1 ? { streetAddress: business.addressLine1 } : {}),
        ...(business.postalCode ? { postalCode: business.postalCode } : {}),
        ...(business.city ? { addressLocality: business.city } : {}),
        addressCountry: "SE",
      },
    } : {}),
    ...(business.city ? { areaServed: business.city } : {}),
    ...(hasActualBusinessMedia ? { image: absoluteUrl(business.media!.url) } : {}),
  };

  return (
    <main className="min-h-screen bg-[#f6f7f5] px-4 py-8 text-[#17201a] sm:px-6 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="text-lg font-black text-[#173e2b]">Proffera</Link>
          <Link
            href={`/en/companies/${encodeURIComponent(business.slug)}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#173e2b]/15 bg-white px-3 text-sm font-black text-[#173e2b]"
          >
            <Languages className="h-4 w-4" /> EN English
          </Link>
        </header>

        <article className="mt-7 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-black/10">
          {hasActualBusinessMedia ? (
            <div className="relative h-52 sm:h-64">
              <Image
                src={business.media!.url}
                alt={business.companyName}
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 960px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="h-2 bg-[#173e2b]" aria-hidden="true" />
          )}

          <div className="p-6 sm:p-9">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#e8f2ec] px-3 py-1 text-xs font-black text-[#173e2b]">{category}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f2] px-3 py-1 text-xs font-bold text-[#536057]">
                    <ShieldCheck className="h-3.5 w-3.5" /> Officiella företagsdata
                  </span>
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{business.companyName}</h1>
                {location ? (
                  <p className="mt-3 flex items-center gap-2 text-[#5e685f]"><MapPin className="h-4 w-4" /> {location}</p>
                ) : null}
              </div>

              <Link
                href={`/foretag/claim/${encodeURIComponent(business.slug)}`}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#173e2b] px-5 font-black text-white"
              >
                Äger du företaget? <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              <section className="rounded-2xl bg-[#f7f8f6] p-5">
                <Building2 className="h-5 w-5 text-[#173e2b]" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">Bransch</p>
                <p className="mt-1 font-bold">{business.primarySniLabel || category}</p>
              </section>
              <section className="rounded-2xl bg-[#f7f8f6] p-5">
                <BadgeCheck className="h-5 w-5 text-[#173e2b]" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">Status</p>
                <p className="mt-1 font-bold">{business.organizationStatus || "Aktiv organisation"}</p>
              </section>
              <section className="rounded-2xl bg-[#f7f8f6] p-5">
                <ShieldCheck className="h-5 w-5 text-[#173e2b]" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">Datakvalitet</p>
                <p className="mt-1 font-bold">Automatiskt datakontrollerad</p>
              </section>
            </div>

            {business.activityDescription ? (
              <section className="mt-9">
                <h2 className="text-xl font-black">Om verksamheten</h2>
                <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-[#566058]">{business.activityDescription}</p>
              </section>
            ) : null}

            <section className="mt-9 border-t border-black/10 pt-6">
              <h2 className="text-base font-black">Företagsuppgifter</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                {business.legalForm ? <div><dt className="text-[#6b746d]">Företagsform</dt><dd className="mt-1 font-bold">{business.legalForm}</dd></div> : null}
                {business.city ? <div><dt className="text-[#6b746d]">Ort</dt><dd className="mt-1 font-bold">{business.city}</dd></div> : null}
                {business.municipality ? <div><dt className="text-[#6b746d]">Kommun</dt><dd className="mt-1 font-bold">{business.municipality}</dd></div> : null}
                {business.addressLine1 ? <div><dt className="text-[#6b746d]">Adress</dt><dd className="mt-1 font-bold">{business.addressLine1}</dd></div> : null}
              </dl>
            </section>

            <aside className="mt-8 rounded-2xl border border-[#d7e4da] bg-[#f2f8f4] p-5 text-sm leading-6 text-[#425047]">
              <p className="font-black text-[#173e2b]">Var kommer informationen från?</p>
              <p className="mt-1">
                Grunduppgifterna kommer från officiell företagsdata och kvalitetssäkras automatiskt av Proffera. Senast kontrollerad: {lastChecked}.
              </p>
              <p className="mt-2">Detta betyder inte att företagets ägare har verifierat eller gjort anspråk på profilen.</p>
              {!hasActualBusinessMedia ? (
                <p className="mt-2">Ingen företagsbild visas förrän en verifierad bild finns tillgänglig.</p>
              ) : null}
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
