import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowLeft, CalendarCheck2, Clock3, Languages, Mail, MapPin, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import { PublicBusinessContactForm } from "@/components/public-business/public-contact-form";
import { PublicBusinessQuoteForm } from "@/components/public-business/public-quote-form";
import { PublicBusinessTrackedLink, PublicBusinessViewEvent } from "@/components/public-business/public-business-tracking";
import { formatPublicBusinessPrice, getPublicBusinessService } from "@/lib/public-business-hub";
import {
  firstPublicBusinessLocaleParam,
  publicBusinessCopy,
  resolvePublicBusinessLocale,
  withPublicBusinessLocale,
} from "@/lib/public-business-locale";
import {
  buildPublicServiceJsonLd,
  resolvePublicBusinessUrlContext,
  serializePublicBusinessJsonLd,
} from "@/lib/public-business-seo";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspace: string; service: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { workspace, service } = await params;
  const query = searchParams ? await searchParams : undefined;
  const [result, requestHeaders] = await Promise.all([getPublicBusinessService(workspace, service), headers()]);
  if (!result) return {};

  const locale = resolvePublicBusinessLocale(result.workspace.experience, firstPublicBusinessLocaleParam(query?.lang));
  const urls = await resolvePublicBusinessUrlContext(requestHeaders.get("host"), result.workspace.slug);
  const canonical = urls.serviceCanonical(result.service.publicSlug);
  const title = result.service.seoTitle || `${result.service.name} – ${result.workspace.companyName}`;
  const description = result.service.seoDescription || result.service.shortDescription || result.service.description || (locale === "en"
    ? `Learn more about ${result.service.name} from ${result.workspace.companyName}.`
    : `Läs mer om ${result.service.name} hos ${result.workspace.companyName}.`);
  const images = result.service.coverImageUrl ? [{ url: result.service.coverImageUrl, alt: result.service.name }] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "website", url: canonical, images },
  };
}

export default async function PublicServicePage({ params, searchParams }: Props) {
  const { workspace, service } = await params;
  const query = searchParams ? await searchParams : undefined;
  const [result, requestHeaders] = await Promise.all([getPublicBusinessService(workspace, service), headers()]);
  if (!result) notFound();

  const { workspace: business, service: item } = result;
  const experience = business.experience;
  const locale = resolvePublicBusinessLocale(experience, firstPublicBusinessLocaleParam(query?.lang));
  const urls = await resolvePublicBusinessUrlContext(requestHeaders.get("host"), business.slug);
  const jsonLd = buildPublicServiceJsonLd(business, item, urls);
  const t = publicBusinessCopy[locale];
  const serviceCopy = t.service;
  const otherLocale = locale === "sv" ? "en" : "sv";
  const showLanguageSwitch = experience.swedishEnabled && experience.englishEnabled;
  const companyHref = withPublicBusinessLocale(urls.companyHref, locale);
  const languageSwitchHref = withPublicBusinessLocale(urls.serviceHref(item.publicSlug), otherLocale);

  const dark = experience.appearance === "dark";
  const background = dark ? "#101512" : experience.themeKey === "premium" ? "#f4f0e8" : experience.themeKey === "modern" ? "#edf4f6" : "#f7f8f5";
  const card = dark ? "#19211c" : "#ffffff";
  const text = dark ? "#f5f7f5" : "#17201a";
  const muted = dark ? "#b9c3bc" : "#5d685f";
  const subtleBorder = dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.10)";
  const style = { "--business-primary": experience.primaryColor, "--business-accent": experience.accentColor, background, color: text } as CSSProperties;
  const price = formatPublicBusinessPrice(item, business.billingCurrency, locale === "en" ? "en-SE" : "sv-SE");
  const canBook = business.bookingEnabled && Boolean(business.bookingSlug) && (item.conversionMode === "book" || item.conversionMode === "book_or_quote");
  const canQuote = item.conversionMode === "quote" || item.conversionMode === "book_or_quote";
  const canContact = item.conversionMode === "contact";
  const bookingHref = withPublicBusinessLocale(`/boka/${encodeURIComponent(business.bookingSlug)}?service_id=${encodeURIComponent(item.id)}`, locale);

  return (
    <main lang={locale} style={style} className="min-h-screen px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializePublicBusinessJsonLd(jsonLd) }} />
      <PublicBusinessViewEvent workspaceId={business.id} serviceId={item.id} />
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <a href={companyHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-black text-[var(--business-primary)]"><ArrowLeft className="h-4 w-4" /> {serviceCopy.backTo(business.companyName)}</a>
          {showLanguageSwitch ? <a href={languageSwitchHref} aria-label={t.languageSwitchLabel} style={{ borderColor: subtleBorder }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-black"><Languages className="h-4 w-4" /> <span className="hidden sm:inline">{t.languageSwitch}</span></a> : null}
        </div>

        <section style={{ background: card }} className="mt-4 overflow-hidden rounded-[2rem] shadow-lg ring-1 ring-black/10">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_.8fr]">
            <div className="p-7 sm:p-10">
              {item.category ? <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">{item.category}</p> : null}
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">{item.name}</h1>
              <p style={{ color: muted }} className="mt-5 max-w-2xl text-base leading-7">{item.shortDescription || item.description || serviceCopy.fallback}</p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm font-bold">
                {price ? <span className="rounded-full bg-black/[.05] px-4 py-2 text-[var(--business-primary)]">{price}</span> : null}
                {item.durationMinutes ? <span style={{ color: muted }} className="inline-flex items-center gap-2 rounded-full bg-black/[.04] px-4 py-2"><Clock3 className="h-4 w-4" /> {item.durationMinutes} min</span> : null}
                {item.serviceArea ? <span style={{ color: muted }} className="inline-flex items-center gap-2 rounded-full bg-black/[.04] px-4 py-2"><MapPin className="h-4 w-4" /> {item.serviceArea}</span> : null}
              </div>
              <div className="mt-8 hidden flex-wrap gap-3 lg:flex">
                {canBook ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="book_clicked" href={bookingHref} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--business-primary)] px-5 font-black text-white"><CalendarCheck2 className="mr-2 h-5 w-5" /> {serviceCopy.bookOnline}</PublicBusinessTrackedLink> : null}
                {canQuote ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="quote_clicked" href="#offert" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/15 px-5 font-black">{serviceCopy.requestQuote}</PublicBusinessTrackedLink> : null}
                {canContact ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="contact_clicked" href="#kontaktforfragan" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/15 px-5 font-black"><Mail className="mr-2 h-4 w-4" /> {serviceCopy.contact}</PublicBusinessTrackedLink> : null}
              </div>
            </div>
            {item.coverImageUrl ? <img src={item.coverImageUrl} alt={item.name} className="h-full min-h-72 w-full object-cover" /> : <div style={{ background: experience.primaryColor }} className="flex min-h-56 items-center justify-center p-8 text-white"><div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-3xl font-black">{item.name.slice(0, 1).toUpperCase()}</div><p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-white/70">{business.companyName}</p>{business.primaryCity ? <p className="mt-2 text-white/80">{business.primaryCity}</p> : null}</div></div>}
          </div>
        </section>

        {item.description && item.description !== item.shortDescription ? <section style={{ background: card }} className="mt-6 rounded-[1.6rem] p-7 ring-1 ring-black/10 sm:p-8"><h2 className="text-2xl font-black">{serviceCopy.about}</h2><p style={{ color: muted }} className="mt-4 whitespace-pre-line leading-7">{item.description}</p></section> : null}

        {canQuote ? <section id="offert" style={{ background: card }} className="mt-6 scroll-mt-24 rounded-[1.6rem] p-7 ring-1 ring-black/10 sm:p-8"><div className="mb-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">{serviceCopy.quoteEyebrow}</p><h2 className="mt-2 text-2xl font-black">{serviceCopy.quoteTitle}</h2><p style={{ color: muted }} className="mt-2 text-sm leading-6">{serviceCopy.quoteLead(business.companyName, item.name)}</p></div><PublicBusinessQuoteForm workspaceSlug={business.slug} serviceId={item.id} serviceName={item.name} locale={locale} /></section> : null}

        {canContact ? <section id="kontaktforfragan" style={{ background: card }} className="mt-6 scroll-mt-24 rounded-[1.6rem] p-7 ring-1 ring-black/10 sm:p-8"><div className="mb-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">{serviceCopy.contactEyebrow}</p><h2 className="mt-2 text-2xl font-black">{serviceCopy.contactTitle}</h2><p style={{ color: muted }} className="mt-2 text-sm leading-6">{serviceCopy.contactLead(business.companyName)}</p></div><PublicBusinessContactForm workspaceId={business.id} serviceId={item.id} locale={locale} /></section> : null}

        {experience.contactEnabled && (business.contactEmail || business.contactPhone) ? <section style={{ background: card }} className="mt-6 rounded-[1.6rem] p-7 ring-1 ring-black/10 sm:p-8"><h2 className="text-2xl font-black">{serviceCopy.contactDetails}</h2><div className="mt-5 flex flex-wrap gap-3">{business.contactPhone ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="contact_clicked" href={`tel:${business.contactPhone}`} className="inline-flex min-h-12 items-center rounded-xl border border-black/15 px-5 font-bold"><Phone className="mr-2 h-4 w-4" /> {business.contactPhone}</PublicBusinessTrackedLink> : null}{business.contactEmail ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="contact_clicked" href={`mailto:${business.contactEmail}?subject=${encodeURIComponent(item.name)}`} className="inline-flex min-h-12 items-center rounded-xl border border-black/15 px-5 font-bold"><Mail className="mr-2 h-4 w-4" /> {business.contactEmail}</PublicBusinessTrackedLink> : null}</div></section> : null}

        <footer style={{ color: muted }} className="mt-8 flex flex-col gap-2 border-t border-black/10 py-6 text-xs sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} {business.companyName}</span><span>{serviceCopy.footer}</span></footer>
      </div>

      {canBook || canQuote || canContact ? <div style={{ background: card, borderColor: subtleBorder, paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }} className="fixed inset-x-0 bottom-0 z-40 border-t px-3 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,.08)] backdrop-blur lg:hidden"><div className="mx-auto flex max-w-5xl gap-2">{canBook ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="book_clicked" href={bookingHref} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--business-primary)] px-4 text-sm font-black text-white"><CalendarCheck2 className="mr-2 h-4 w-4" /> {serviceCopy.bookOnline}</PublicBusinessTrackedLink> : null}{canQuote ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="quote_clicked" href="#offert" className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 text-sm font-black ${canBook ? "border border-black/15" : "bg-[var(--business-primary)] text-white"}`}>{serviceCopy.requestQuote}</PublicBusinessTrackedLink> : null}{canContact ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="contact_clicked" href="#kontaktforfragan" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--business-primary)] px-4 text-sm font-black text-white"><Mail className="mr-2 h-4 w-4" /> {serviceCopy.contact}</PublicBusinessTrackedLink> : null}</div></div> : null}
    </main>
  );
}
