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
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";
import { getPublicDirectoryProfileExtras } from "@/lib/company-directory-public-profile-extras";
import { getClaimedDirectoryWorkspaceSlug } from "@/lib/company-directory-routing";
import type { PublicLocale } from "@/lib/public-locale";
import { siteConfig } from "@/lib/site";

function absoluteUrl(value: string) {
  return new URL(value, siteConfig.url).toString();
}

export async function PublicDirectoryProfile({ slug, locale }: { slug: string; locale: PublicLocale }) {
  const business = await getPublicDirectoryBusinessForRequest(slug);
  if (!business) {
    const workspaceSlug = await getClaimedDirectoryWorkspaceSlug(slug);
    if (workspaceSlug) redirect(locale === "en" ? `/foretag/${encodeURIComponent(workspaceSlug)}?lang=en` : `/foretag/${encodeURIComponent(workspaceSlug)}`);
    notFound();
  }
  if (business.publicationStatus === "claimed") {
    const workspaceSlug = await getClaimedDirectoryWorkspaceSlug(slug);
    if (workspaceSlug) redirect(locale === "en" ? `/foretag/${encodeURIComponent(workspaceSlug)}?lang=en` : `/foretag/${encodeURIComponent(workspaceSlug)}`);
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
  });
  const radiusFormatter = new Intl.NumberFormat(locale === "en" ? "en-SE" : "sv-SE", { maximumFractionDigits: 1 });

  return (
    <main lang={locale} className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3">
          <Link href={directoryPaths[locale].home} className="text-lg font-black tracking-tight text-brand">Proffera</Link>
          <Link href={`${alternateBase}/${encodeURIComponent(business.slug)}`} className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-black text-brand shadow-sm transition hover:border-brand/25 hover:bg-brand-soft">
            <Languages className="h-4 w-4" /> {t.language}
          </Link>
        </header>

        <Link href={profileBase} className="mt-6 inline-flex text-sm font-black text-brand transition hover:text-brand-strong">← {locale === "en" ? "Back to companies" : "Tillbaka till företag"}</Link>

        <article className="mt-4 overflow-hidden rounded-panel border border-line bg-surface shadow-card">
          {hasMedia ? (
            <div className="relative h-52 sm:h-72">
              <Image src={business.media!.url} alt={business.companyName} fill unoptimized sizes="(max-width: 1024px) 100vw, 960px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" aria-hidden="true" />
            </div>
          ) : (
            <div className="h-3 bg-brand" aria-hidden="true" />
          )}

          <div className="p-6 sm:p-9">
            <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">{category}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold text-body"><ShieldCheck className="h-3.5 w-3.5" /> {t.official}</span>
                </div>
                <h1 className="mt-4 break-words text-3xl font-black tracking-[-0.035em] text-ink sm:text-5xl">{business.companyName}</h1>
                {location ? <p className="mt-3 flex items-center gap-2 text-body"><MapPin className="h-4 w-4 text-brand" /> {location}</p> : null}
              </div>
              {locale === "sv" && business.publicationStatus !== "claimed" ? (
                <Link href={`/foretag/claim/${encodeURIComponent(business.slug)}`} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-control bg-brand px-5 font-black text-white transition hover:bg-brand-strong">
                  {t.claim}<ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              ) : null}
            </div>

            <div className="grid divide-y divide-line border-b border-line py-2 md:grid-cols-3 md:divide-x md:divide-y-0">
              <section className="py-5 md:px-5 md:first:pl-0">
                <Building2 className="h-5 w-5 text-brand" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-muted">{t.industry}</p>
                <p className="mt-1 font-bold text-ink">{business.primarySniLabel || category}</p>
              </section>
              <section className="py-5 md:px-5">
                <BadgeCheck className="h-5 w-5 text-brand" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-muted">{t.status}</p>
                <p className="mt-1 font-bold text-ink">{business.organizationStatus || t.active}</p>
              </section>
              <section className="py-5 md:px-5 md:last:pr-0">
                <ShieldCheck className="h-5 w-5 text-brand" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-muted">{t.quality}</p>
                <p className="mt-1 font-bold text-ink">{t.checked}</p>
              </section>
            </div>

            {business.activityDescription ? (
              <section className="mt-9">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">{t.about}</p>
                <p lang="sv" className="mt-3 max-w-3xl whitespace-pre-line text-base leading-8 text-body">{business.activityDescription}</p>
              </section>
            ) : null}

            {extras.services.length ? (
              <section className="mt-10 border-t border-line pt-8">
                <h2 className="text-xl font-black tracking-tight text-ink">{t.services}</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {extras.services.map((service) => (
                    <div key={service.slug} className="rounded-control border border-line bg-surface-subtle px-4 py-3">
                      <p className="font-black text-ink">{directoryServiceLabel(service.slug, service.label, locale)}</p>
                      <p className="mt-1 text-xs font-bold text-muted">
                        {service.sourceType === "sni" ? t.serviceSni : service.confirmed ? t.serviceConfirmed : t.servicePublic}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {extras.serviceAreas.length ? (
              <section className="mt-10 border-t border-line pt-8">
                <h2 className="text-xl font-black tracking-tight text-ink">{t.serviceAreas}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {extras.serviceAreas.map((area, index) => {
                    const areaLabel = area.serviceSlug
                      ? directoryServiceLabel(area.serviceSlug, area.serviceLabel, locale)
                      : t.generalArea;
                    return (
                      <div key={`${area.serviceSlug || "general"}-${area.radiusKm}-${index}`} className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface-subtle p-4 text-sm">
                        <p className="font-black text-ink">{areaLabel}</p>
                        <p className="shrink-0 text-muted">{radiusFormatter.format(area.radiusKm)} km {t.radius}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <section className="rounded-panel border border-brand/15 bg-brand-soft p-6">
                <FileText className="h-6 w-6 text-brand" />
                <h2 className="mt-4 text-xl font-black text-brand-deep">{t.quoteTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-body">{t.quoteLead}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-muted">{t.quoteDisclosure}</p>
                <Link href={quoteHref} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong">
                  {t.quoteCta}<ArrowRight className="h-4 w-4" />
                </Link>
              </section>

              <section className="rounded-panel bg-brand-deep p-6 text-white">
                <Search className="h-6 w-6 text-white/80" />
                <h2 className="mt-4 text-xl font-black">{t.similarTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-white/70">{t.similarLead}</p>
                <Link href={similarHref} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-white px-4 text-sm font-black text-brand-deep transition hover:bg-brand-soft">
                  {t.similarCta}<ArrowRight className="h-4 w-4" />
                </Link>
              </section>
            </div>

            <section className="mt-10 border-t border-line pt-8">
              <h2 className="text-base font-black text-ink">{t.details}</h2>
              <dl className="mt-5 grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
                {business.legalForm ? <div className="border-b border-line pb-4"><dt className="text-muted">{t.legalForm}</dt><dd className="mt-1 font-bold text-ink">{business.legalForm}</dd></div> : null}
                {business.city ? <div className="border-b border-line pb-4"><dt className="text-muted">{t.city}</dt><dd className="mt-1 font-bold text-ink">{business.city}</dd></div> : null}
                {business.municipality ? <div className="border-b border-line pb-4"><dt className="text-muted">{t.municipality}</dt><dd className="mt-1 font-bold text-ink">{business.municipality}</dd></div> : null}
                {business.addressLine1 ? <div className="border-b border-line pb-4"><dt className="text-muted">{t.address}</dt><dd className="mt-1 font-bold text-ink">{business.addressLine1}</dd></div> : null}
              </dl>
            </section>

            <aside className="mt-8 rounded-card border border-line bg-surface-subtle p-5 text-sm leading-6 text-body">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div>
                  <p className="font-black text-brand">{t.sourceTitle}</p>
                  <p className="mt-1">{t.sourceLead} {t.lastChecked}: {lastChecked}.</p>
                  <p className="mt-2">{t.sourceOwner}</p>
                  {!hasMedia ? <p className="mt-2">{t.noImage}</p> : null}
                </div>
              </div>
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
