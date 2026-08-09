import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { ArrowRight, Clock3, Languages, Mail, MapPin, Phone, Star } from "lucide-react";
import { notFound } from "next/navigation";

import { PublicBusinessContactForm } from "@/components/public-business/public-contact-form";
import { PublicBusinessTrackedLink, PublicBusinessViewEvent } from "@/components/public-business/public-business-tracking";
import { formatPublicBusinessPrice, getPublicBusinessHub } from "@/lib/public-business-hub";
import {
  firstPublicBusinessLocaleParam,
  publicBusinessCopy,
  resolvePublicBusinessLocale,
  withPublicBusinessLocale,
} from "@/lib/public-business-locale";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspace: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { workspace } = await params;
  const query = searchParams ? await searchParams : undefined;
  const hub = await getPublicBusinessHub(workspace);
  if (!hub) return {};
  const locale = resolvePublicBusinessLocale(hub.workspace.experience, firstPublicBusinessLocaleParam(query?.lang));
  const title = hub.workspace.companyName;
  const description = hub.workspace.businessIntro || (locale === "en"
    ? `${title} – services, booking and contact via Proffera.`
    : `${title} – tjänster, bokning och kontakt via Proffera.`);
  return { title, description, openGraph: { title, description, type: "website" } };
}

export default async function PublicBusinessPage({ params, searchParams }: Props) {
  const { workspace } = await params;
  const query = searchParams ? await searchParams : undefined;
  const hub = await getPublicBusinessHub(workspace);
  if (!hub) notFound();

  const { workspace: business, services, reviews, gallery } = hub;
  const experience = business.experience;
  const locale = resolvePublicBusinessLocale(experience, firstPublicBusinessLocaleParam(query?.lang));
  const t = publicBusinessCopy[locale];
  const companyCopy = t.company;
  const otherLocale = locale === "sv" ? "en" : "sv";
  const showLanguageSwitch = experience.swedishEnabled && experience.englishEnabled;
  const languageSwitchHref = withPublicBusinessLocale(`/foretag/${encodeURIComponent(business.slug)}`, otherLocale);

  const dark = experience.appearance === "dark";
  const background = dark ? "#101512" : experience.themeKey === "premium" ? "#f4f0e8" : experience.themeKey === "modern" ? "#edf4f6" : "#f7f8f5";
  const card = dark ? "#19211c" : "#ffffff";
  const text = dark ? "#f5f7f5" : "#17201a";
  const muted = dark ? "#b9c3bc" : "#5d685f";
  const subtleBorder = dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.10)";
  const style = { "--business-primary": experience.primaryColor, "--business-accent": experience.accentColor, background, color: text } as CSSProperties;
  const bookingHref = business.bookingEnabled && business.bookingSlug
    ? withPublicBusinessLocale(`/boka/${encodeURIComponent(business.bookingSlug)}`, locale)
    : "";

  return (
    <main lang={locale} style={style} className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <PublicBusinessViewEvent workspaceId={business.id} />
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 pb-6">
          <div className="flex min-w-0 items-center gap-3">
            {experience.logoUrl ? <img src={experience.logoUrl} alt={`${business.companyName} logotyp`} className="max-h-12 max-w-40 object-contain" /> : <div style={{ background: experience.primaryColor }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white">{business.companyName.slice(0, 1).toUpperCase()}</div>}
            <div className="min-w-0"><p className="truncate text-lg font-black">{business.companyName}</p>{business.primaryCity ? <p style={{ color: muted }} className="truncate text-sm">{business.primaryCity}</p> : null}</div>
          </div>
          <div className="flex items-center gap-2">
            {showLanguageSwitch ? <a href={languageSwitchHref} aria-label={t.languageSwitchLabel} style={{ borderColor: subtleBorder }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-black"><Languages className="h-4 w-4" /> <span className="hidden sm:inline">{t.languageSwitch}</span></a> : null}
            {bookingHref ? <PublicBusinessTrackedLink workspaceId={business.id} eventKey="book_clicked" href={bookingHref} className="hidden min-h-11 items-center justify-center rounded-xl bg-[var(--business-primary)] px-5 text-sm font-black text-white sm:inline-flex">{companyCopy.bookTime}</PublicBusinessTrackedLink> : null}
          </div>
        </header>

        {experience.heroEnabled ? <section style={{ background: experience.primaryColor }} className="overflow-hidden rounded-[2rem] text-white shadow-xl">
          <div className={`grid ${experience.heroImageUrl || experience.heroVideoUrl ? "lg:grid-cols-[1.1fr_.9fr]" : ""}`}>
            <div className="p-7 sm:p-10 lg:p-12">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{companyCopy.heroEyebrow}</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{business.companyName}</h1>
              {business.primaryCity ? <p className="mt-4 flex items-center gap-2 text-white/80"><MapPin className="h-5 w-5" /> {business.primaryCity}</p> : null}
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/85">{business.businessIntro || companyCopy.defaultIntro}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {services.length ? <a href="#tjanster" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 font-black text-[#173e2b]">{companyCopy.seeServices} <ArrowRight className="ml-2 h-4 w-4" /></a> : bookingHref ? <PublicBusinessTrackedLink workspaceId={business.id} eventKey="book_clicked" href={bookingHref} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 font-black text-[#173e2b]">{companyCopy.bookOnline} <ArrowRight className="ml-2 h-4 w-4" /></PublicBusinessTrackedLink> : null}
                {experience.contactEnabled ? <PublicBusinessTrackedLink workspaceId={business.id} eventKey="contact_clicked" href="#kontakt" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/35 px-5 font-black text-white">{companyCopy.contactUs}</PublicBusinessTrackedLink> : null}
              </div>
            </div>
            {experience.heroVideoUrl ? <video src={experience.heroVideoUrl} controls muted playsInline className="h-full min-h-72 w-full object-cover" /> : experience.heroImageUrl ? <img src={experience.heroImageUrl} alt="" className="h-full min-h-72 w-full object-cover" /> : null}
          </div>
        </section> : null}

        {experience.servicesEnabled ? <section className="py-14" id="tjanster">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">{companyCopy.servicesEyebrow}</p><h2 className="mt-2 text-3xl font-black">{companyCopy.servicesTitle}</h2></div><p style={{ color: muted }} className="max-w-xl text-sm leading-6">{companyCopy.servicesLead}</p></div>
          {services.length ? <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{services.map((service) => {
            const price = formatPublicBusinessPrice(service, business.billingCurrency, locale === "en" ? "en-SE" : "sv-SE");
            const serviceHref = withPublicBusinessLocale(`/foretag/${encodeURIComponent(business.slug)}/tjanster/${encodeURIComponent(service.publicSlug)}`, locale);
            return <a key={service.id} href={serviceHref} style={{ background: card }} className="group overflow-hidden rounded-[1.6rem] shadow-sm ring-1 ring-black/10 transition hover:-translate-y-1 hover:shadow-lg">
              {service.coverImageUrl ? <img src={service.coverImageUrl} alt={service.name} loading="lazy" className="h-48 w-full object-cover" /> : null}
              <div className="p-6"><div className="flex items-start justify-between gap-3"><div>{service.category ? <p style={{ color: muted }} className="text-xs font-black uppercase tracking-wide">{service.category}</p> : null}<h3 className="mt-2 text-xl font-black">{service.name}</h3></div><ArrowRight className="h-5 w-5 shrink-0 text-[var(--business-primary)] transition group-hover:translate-x-1" /></div><p style={{ color: muted }} className="mt-4 line-clamp-3 text-sm leading-6">{service.shortDescription || service.description || companyCopy.serviceFallback}</p><div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-bold">{price ? <span className="text-[var(--business-primary)]">{price}</span> : null}{service.durationMinutes ? <span style={{ color: muted }} className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" /> {service.durationMinutes} min</span> : null}</div></div>
            </a>;
          })}</div> : <div style={{ background: card, color: muted }} className="mt-7 rounded-3xl p-6 ring-1 ring-black/10">{companyCopy.noServices}</div>}
        </section> : null}

        {experience.galleryEnabled && gallery.length ? <section className="pb-14"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">{companyCopy.galleryEyebrow}</p><h2 className="mt-2 text-3xl font-black">{companyCopy.galleryTitle}</h2><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">{gallery.map((item, index) => item.mediaType === "video" ? <video key={item.id} src={item.publicUrl} controls muted playsInline className={`w-full rounded-2xl object-cover ${index === 0 ? "col-span-2 row-span-2 h-full min-h-64" : "h-48"}`} /> : <img key={item.id} src={item.publicUrl} alt={item.altText || item.title || business.companyName} className={`w-full rounded-2xl object-cover ${index === 0 ? "col-span-2 row-span-2 h-full min-h-64" : "h-48"}`} />)}</div></section> : null}

        {experience.reviewsEnabled && reviews.length ? <section className="pb-14"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">{companyCopy.reviewsEyebrow}</p><h2 className="mt-2 text-3xl font-black">{companyCopy.reviewsTitle}</h2></div><div className="flex items-center gap-1 text-sm font-black"><Star className="h-5 w-5 fill-current text-[var(--business-accent)]" /> {(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)}</div></div><div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{reviews.slice(0, 6).map((review) => <article key={review.id} style={{ background: card }} className="rounded-3xl p-6 ring-1 ring-black/10"><div className="flex gap-1 text-[var(--business-accent)]" aria-label={`${review.rating} ${locale === "en" ? "of 5 stars" : "av 5 stjärnor"}`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-4 w-4 ${index < review.rating ? "fill-current" : "opacity-25"}`} />)}</div><p className="mt-4 text-sm leading-6">“{review.message}”</p><p style={{ color: muted }} className="mt-4 text-sm font-bold">{review.reviewerName}{review.area ? ` · ${review.area}` : ""}</p></article>)}</div></section> : null}

        {experience.contactEnabled ? <section id="kontakt" style={{ background: card }} className="mb-8 rounded-[2rem] p-7 ring-1 ring-black/10 sm:p-9"><div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">{companyCopy.contactEyebrow}</p><h2 className="mt-2 text-3xl font-black">{companyCopy.contactTitle}</h2><p style={{ color: muted }} className="mt-3 max-w-2xl text-sm leading-6">{companyCopy.contactLead(business.companyName)}</p><div className="mt-6"><PublicBusinessContactForm workspaceId={business.id} locale={locale} /></div></div><aside className="grid content-start gap-3"><p className="text-sm font-black">{companyCopy.directContact}</p>{business.contactPhone ? <PublicBusinessTrackedLink workspaceId={business.id} eventKey="contact_clicked" href={`tel:${business.contactPhone}`} className="inline-flex min-h-12 items-center rounded-xl border border-black/10 px-5 font-bold"><Phone className="mr-2 h-4 w-4" /> {business.contactPhone}</PublicBusinessTrackedLink> : null}{business.contactEmail ? <PublicBusinessTrackedLink workspaceId={business.id} eventKey="contact_clicked" href={`mailto:${business.contactEmail}`} className="inline-flex min-h-12 items-center rounded-xl border border-black/10 px-5 font-bold"><Mail className="mr-2 h-4 w-4" /> {business.contactEmail}</PublicBusinessTrackedLink> : null}{bookingHref ? <PublicBusinessTrackedLink workspaceId={business.id} eventKey="book_clicked" href={bookingHref} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--business-primary)] px-5 font-black text-white">{companyCopy.bookOnline}</PublicBusinessTrackedLink> : null}</aside></div></section> : null}

        <footer style={{ color: muted }} className="flex flex-col gap-2 border-t border-black/10 py-6 text-xs sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} {business.companyName}</span><span>{companyCopy.footer}</span></footer>
      </div>
    </main>
  );
}
