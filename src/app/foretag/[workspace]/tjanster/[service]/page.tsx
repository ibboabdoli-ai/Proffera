import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { ArrowLeft, CalendarCheck2, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import { PublicBusinessQuoteForm } from "@/components/public-business/public-quote-form";
import { PublicBusinessTrackedLink, PublicBusinessViewEvent } from "@/components/public-business/public-business-tracking";
import { formatPublicBusinessPrice, getPublicBusinessService } from "@/lib/public-business-hub";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspace: string; service: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspace, service } = await params;
  const result = await getPublicBusinessService(workspace, service);
  if (!result) return {};
  const title = result.service.seoTitle || `${result.service.name} – ${result.workspace.companyName}`;
  const description = result.service.seoDescription || result.service.shortDescription || result.service.description;
  const images = result.service.coverImageUrl ? [{ url: result.service.coverImageUrl, alt: result.service.name }] : undefined;
  return { title, description, openGraph: { title, description, type: "website", images } };
}

export default async function PublicServicePage({ params }: Props) {
  const { workspace, service } = await params;
  const result = await getPublicBusinessService(workspace, service);
  if (!result) notFound();

  const { workspace: business, service: item } = result;
  const experience = business.experience;
  const dark = experience.appearance === "dark";
  const background = dark ? "#101512" : experience.themeKey === "premium" ? "#f4f0e8" : experience.themeKey === "modern" ? "#edf4f6" : "#f7f8f5";
  const card = dark ? "#19211c" : "#ffffff";
  const text = dark ? "#f5f7f5" : "#17201a";
  const muted = dark ? "#b9c3bc" : "#5d685f";
  const style = { "--business-primary": experience.primaryColor, "--business-accent": experience.accentColor, background, color: text } as CSSProperties;
  const price = formatPublicBusinessPrice(item, business.billingCurrency);
  const canBook = business.bookingEnabled && Boolean(business.bookingSlug) && (item.conversionMode === "book" || item.conversionMode === "book_or_quote");
  const canQuote = item.conversionMode === "quote" || item.conversionMode === "book_or_quote";
  const canContact = item.conversionMode === "contact";
  const bookingHref = `/boka/${encodeURIComponent(business.bookingSlug)}?service_id=${encodeURIComponent(item.id)}`;

  return (
    <main style={style} className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <PublicBusinessViewEvent workspaceId={business.id} serviceId={item.id} />
      <div className="mx-auto max-w-5xl">
        <a href={`/foretag/${encodeURIComponent(business.slug)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-black text-[var(--business-primary)]"><ArrowLeft className="h-4 w-4" /> Till {business.companyName}</a>

        <section style={{ background: card }} className="mt-4 overflow-hidden rounded-[2rem] shadow-lg ring-1 ring-black/10">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_.8fr]">
            <div className="p-7 sm:p-10">
              {item.category ? <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">{item.category}</p> : null}
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">{item.name}</h1>
              <p style={{ color: muted }} className="mt-5 max-w-2xl text-base leading-7">{item.shortDescription || item.description || "Kontakta företaget för mer information om tjänsten."}</p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm font-bold">
                {price ? <span className="rounded-full bg-black/[.05] px-4 py-2 text-[var(--business-primary)]">{price}</span> : null}
                {item.durationMinutes ? <span style={{ color: muted }} className="inline-flex items-center gap-2 rounded-full bg-black/[.04] px-4 py-2"><Clock3 className="h-4 w-4" /> {item.durationMinutes} min</span> : null}
                {item.serviceArea ? <span style={{ color: muted }} className="inline-flex items-center gap-2 rounded-full bg-black/[.04] px-4 py-2"><MapPin className="h-4 w-4" /> {item.serviceArea}</span> : null}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                {canBook ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="book_clicked" href={bookingHref} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--business-primary)] px-5 font-black text-white"><CalendarCheck2 className="mr-2 h-5 w-5" /> Boka online</PublicBusinessTrackedLink> : null}
                {canQuote ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="quote_clicked" href="#offert" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/15 px-5 font-black">Begär offert</PublicBusinessTrackedLink> : null}
                {canContact && business.contactEmail ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="contact_clicked" href={`mailto:${business.contactEmail}?subject=${encodeURIComponent(item.name)}`} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/15 px-5 font-black"><Mail className="mr-2 h-4 w-4" /> Kontakta</PublicBusinessTrackedLink> : null}
              </div>
            </div>
            {item.coverImageUrl ? <img src={item.coverImageUrl} alt={item.name} className="h-full min-h-72 w-full object-cover" /> : <div style={{ background: experience.primaryColor }} className="flex min-h-56 items-center justify-center p-8 text-white"><div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-3xl font-black">{item.name.slice(0, 1).toUpperCase()}</div><p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-white/70">{business.companyName}</p>{business.primaryCity ? <p className="mt-2 text-white/80">{business.primaryCity}</p> : null}</div></div>}
          </div>
        </section>

        {item.description && item.description !== item.shortDescription ? <section style={{ background: card }} className="mt-6 rounded-[1.6rem] p-7 ring-1 ring-black/10 sm:p-8"><h2 className="text-2xl font-black">Om tjänsten</h2><p style={{ color: muted }} className="mt-4 whitespace-pre-line leading-7">{item.description}</p></section> : null}

        {canQuote ? <section id="offert" style={{ background: card }} className="mt-6 rounded-[1.6rem] p-7 ring-1 ring-black/10 sm:p-8"><div className="mb-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--business-primary)]">Offert</p><h2 className="mt-2 text-2xl font-black">Beskriv vad du behöver</h2><p style={{ color: muted }} className="mt-2 text-sm leading-6">Din förfrågan går direkt till {business.companyName} och kopplas till tjänsten {item.name}.</p></div><PublicBusinessQuoteForm workspaceSlug={business.slug} serviceId={item.id} serviceName={item.name} /></section> : null}

        {experience.contactEnabled && (business.contactEmail || business.contactPhone) ? <section style={{ background: card }} className="mt-6 rounded-[1.6rem] p-7 ring-1 ring-black/10 sm:p-8"><h2 className="text-2xl font-black">Kontakt</h2><div className="mt-5 flex flex-wrap gap-3">{business.contactPhone ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="contact_clicked" href={`tel:${business.contactPhone}`} className="inline-flex min-h-12 items-center rounded-xl border border-black/15 px-5 font-bold"><Phone className="mr-2 h-4 w-4" /> {business.contactPhone}</PublicBusinessTrackedLink> : null}{business.contactEmail ? <PublicBusinessTrackedLink workspaceId={business.id} serviceId={item.id} eventKey="contact_clicked" href={`mailto:${business.contactEmail}?subject=${encodeURIComponent(item.name)}`} className="inline-flex min-h-12 items-center rounded-xl border border-black/15 px-5 font-bold"><Mail className="mr-2 h-4 w-4" /> {business.contactEmail}</PublicBusinessTrackedLink> : null}</div></section> : null}

        <footer style={{ color: muted }} className="mt-8 flex flex-col gap-2 border-t border-black/10 py-6 text-xs sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} {business.companyName}</span><span>Digital kundresa via Proffera</span></footer>
      </div>
    </main>
  );
}
