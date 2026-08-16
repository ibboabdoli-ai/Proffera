import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, FileText, Languages, MapPin, Search, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import {
  directoryCategoryLabels,
  directoryPaths,
  directoryServiceLabel,
} from "@/components/company-directory/public-directory-copy";
import { directoryProfileCopy } from "@/components/company-directory/public-directory-profile-copy";
import { quoteRequestHref } from "@/features/quote-request/directory-prefill";
import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { getPublicDirectoryProfileExtras } from "@/lib/company-directory-public-profile-extras";
import { getClaimedDirectoryWorkspaceSlug } from "@/lib/company-directory-routing";
import type { PublicLocale } from "@/lib/public-locale";
import { siteConfig } from "@/lib/site";

function absoluteUrl(value: string) {
  return new URL(value, siteConfig.url).toString();
}

export async function PublicDirectoryProfile({ slug, locale }: { slug: string; locale: PublicLocale }) {
  const business = await getPublicDirectoryBusiness(slug);
  if (!business) {
    const workspaceSlug = await getClaimedDirectoryWorkspaceSlug(slug);
    if (workspaceSlug) redirect(locale === "en" ? `/foretag/${encodeURIComponent(workspaceSlug)}?lang=en` : `/foretag/${encodeURIComponent(workspaceSlug)}`);
    notFound();
  }

  const extras = await getPublicDirectoryProfileExtras(business.id);
  const t = directoryProfileCopy[locale];
  const category = directoryCategoryLabels[locale][business.categorySlug] ?? business.primarySniLabel ?? t.fallbackCategory;
  const location = [business.postalCode, business.city].filter(Boolean).join(" ");
  const otherLocale: PublicLocale = locale === "sv" ? "en" : "sv";
  const profileBase = directoryPaths[locale].search;
  const alternateBase = directoryPaths[otherLocale].search;
  const lastChecked = business.lastCheckedAt
    ? new Intl.DateTimeFormat(locale === "en" ? "en-SE" : "sv-SE", { dateStyle: "medium", timeZone: "Europe/Stockholm" }).format(new Date(business.lastCheckedAt))
    : t.synced;
  const hasMedia = Boolean(business.media?.isActualBusinessMedia && business.media.url);
  const profilePath = `${profileBase}/${encodeURIComponent(business.slug)}`;
  const canonical = `${siteConfig.url}${profilePath}`;
  const description = business.activityDescription || `${business.companyName}${business.city ? ` i ${business.city}` : ""} – ${category}.`;
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
    ...(hasMedia ? { image: absoluteUrl(business.media!.url) } : {}),
  };

  const primaryServiceSlug = extras.services[0]?.slug;
  const similarParams = new URLSearchParams();
  const similarService = primaryServiceSlug || business.categorySlug;
  if (similarService) similarParams.set("service", similarService);
  if (business.city) similarParams.set("location", business.city);
  const similarQuery = similarParams.toString();
  const similarHref = `${profileBase}${similarQuery ? `?${similarQuery}` : ""}`;
  const quoteHref = quoteRequestHref(locale, {
    categorySlug: business.categorySlug,
    serviceSlug: primaryServiceSlug,
    city: business.city,
  });
  const radiusFormatter = new Intl.NumberFormat(locale === "en" ? "en-SE" : "sv-SE", { maximumFractionDigits: 1 });

  return (
    <main lang={locale} className="min-h-screen bg-[#f6f7f5] px-4 py-6 text-[#17201a] sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3">
          <Link href={directoryPaths[locale].home} className="text-lg font-black text-[#173e2b]">Proffera</Link>
          <Link href={`${alternateBase}/${encodeURIComponent(business.slug)}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#173e2b]/15 bg-white px-3 text-sm font-black text-[#173e2b]"><Languages className="h-4 w-4" /> {t.language}</Link>
        </header>

        <Link href={profileBase} className="mt-5 inline-flex text-sm font-black text-[#173e2b]">← {locale === "en" ? "Back to companies" : "Tillbaka till företag"}</Link>

        <article className="mt-4 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-black/10">
          {hasMedia ? <div className="relative h-52 sm:h-64"><Image src={business.media!.url} alt={business.companyName} fill unoptimized sizes="(max-width: 1024px) 100vw, 960px" className="object-cover" /></div> : <div className="h-2 bg-[#173e2b]" aria-hidden="true" />}

          <div className="p-6 sm:p-9">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#e8f2ec] px-3 py-1 text-xs font-black text-[#173e2b]">{category}</span><span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f2] px-3 py-1 text-xs font-bold text-[#536057]"><ShieldCheck className="h-3.5 w-3.5" /> {t.official}</span></div>
                <h1 className="mt-4 break-words text-3xl font-black tracking-tight sm:text-4xl">{business.companyName}</h1>
                {location ? <p className="mt-3 flex items-center gap-2 text-[#5e685f]"><MapPin className="h-4 w-4" /> {location}</p> : null}
              </div>
              {locale === "sv" ? <Link href={`/foretag/claim/${encodeURIComponent(business.slug)}`} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#173e2b] px-5 font-black text-white">{t.claim}<ArrowRight className="ml-2 h-4 w-4" /></Link> : null}
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              <section className="rounded-2xl bg-[#f7f8f6] p-5"><Building2 className="h-5 w-5 text-[#173e2b]" /><p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">{t.industry}</p><p className="mt-1 font-bold">{business.primarySniLabel || category}</p></section>
              <section className="rounded-2xl bg-[#f7f8f6] p-5"><BadgeCheck className="h-5 w-5 text-[#173e2b]" /><p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">{t.status}</p><p className="mt-1 font-bold">{business.organizationStatus || t.active}</p></section>
              <section className="rounded-2xl bg-[#f7f8f6] p-5"><ShieldCheck className="h-5 w-5 text-[#173e2b]" /><p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">{t.quality}</p><p className="mt-1 font-bold">{t.checked}</p></section>
            </div>

            {business.activityDescription ? <section className="mt-9"><h2 className="text-xl font-black">{t.about}</h2><p lang="sv" className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-[#566058]">{business.activityDescription}</p></section> : null}

            {extras.services.length ? (
              <section className="mt-9 border-t border-black/10 pt-7">
                <h2 className="text-xl font-black">{t.services}</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {extras.services.map((service) => (
                    <div key={service.slug} className="rounded-xl border border-[#dce5de] bg-[#f7faf8] px-4 py-3">
                      <p className="font-black text-[#26352b]">{directoryServiceLabel(service.slug, service.label, locale)}</p>
                      <p className="mt-1 text-xs font-bold text-[#69746c]">
                        {service.sourceType === "sni" ? t.serviceSni : service.confirmed ? t.serviceConfirmed : t.servicePublic}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {extras.serviceAreas.length ? (
              <section className="mt-9 border-t border-black/10 pt-7">
                <h2 className="text-xl font-black">{t.serviceAreas}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {extras.serviceAreas.map((area, index) => {
                    const areaLabel = area.serviceSlug
                      ? directoryServiceLabel(area.serviceSlug, area.serviceLabel, locale)
                      : t.generalArea;
                    return (
                      <div key={`${area.serviceSlug || "general"}-${area.radiusKm}-${index}`} className="rounded-2xl bg-[#f7f8f6] p-4 text-sm">
                        <p className="font-black text-[#26352b]">{areaLabel}</p>
                        <p className="mt-1 text-[#69746c]">{radiusFormatter.format(area.radiusKm)} km {t.radius}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="mt-9 rounded-2xl border border-[#d5e5da] bg-[#eef6f0] p-5 sm:flex sm:items-start sm:justify-between sm:gap-6">
              <div>
                <h2 className="text-lg font-black text-[#173e2b]">{t.quoteTitle}</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[#526057]">{t.quoteLead}</p>
                <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-[#69746c]">{t.quoteDisclosure}</p>
              </div>
              <Link href={quoteHref} className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 text-sm font-black text-white sm:mt-0">
                <FileText className="h-4 w-4" /> {t.quoteCta}
              </Link>
            </section>

            <section className="mt-4 rounded-2xl bg-[#173e2b] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <h2 className="text-lg font-black">{t.similarTitle}</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-white/75">{t.similarLead}</p>
              </div>
              <Link href={similarHref} className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-[#173e2b] sm:mt-0">
                <Search className="h-4 w-4" /> {t.similarCta}
              </Link>
            </section>

            <section className="mt-9 border-t border-black/10 pt-6"><h2 className="text-base font-black">{t.details}</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">{business.legalForm ? <div><dt className="text-[#6b746d]">{t.legalForm}</dt><dd className="mt-1 font-bold">{business.legalForm}</dd></div> : null}{business.city ? <div><dt className="text-[#6b746d]">{t.city}</dt><dd className="mt-1 font-bold">{business.city}</dd></div> : null}{business.municipality ? <div><dt className="text-[#6b746d]">{t.municipality}</dt><dd className="mt-1 font-bold">{business.municipality}</dd></div> : null}{business.addressLine1 ? <div><dt className="text-[#6b746d]">{t.address}</dt><dd className="mt-1 font-bold">{business.addressLine1}</dd></div> : null}</dl></section>

            <aside className="mt-8 rounded-2xl border border-[#d7e4da] bg-[#f2f8f4] p-5 text-sm leading-6 text-[#425047]"><p className="font-black text-[#173e2b]">{t.sourceTitle}</p><p className="mt-1">{t.sourceLead} {t.lastChecked}: {lastChecked}.</p><p className="mt-2">{t.sourceOwner}</p>{!hasMedia ? <p className="mt-2">{t.noImage}</p> : null}</aside>
          </div>
        </article>
      </div>
    </main>
  );
}
