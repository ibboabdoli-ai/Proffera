import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Check,
  ChevronDown,
  CirclePoundSterling,
  Droplets,
  House,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareReply,
  PanelsTopLeft,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Wrench,
} from "lucide-react";

import { PrimeViewQuoteForm } from "./quote-form";
import { PrimeViewReviewForm } from "./review-form";
import { primeViewWorkspaceSlug } from "@/features/primeview/review";
import { primeViewSite, primeViewStructuredData } from "@/lib/primeview-seo";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import {
  getPublishedWebsiteReviews,
  getPublishedWebsiteReviewSummary,
} from "@/lib/website-reviews-db";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();

  if (!isPrimeViewHost(requestHeaders.get("host"))) {
    return {
      robots: { index: false, follow: false },
    };
  }

  return {
    metadataBase: new URL(primeViewSite.origin),
    title: { absolute: primeViewSite.title },
    description: primeViewSite.description,
    applicationName: primeViewSite.name,
    appleWebApp: {
      capable: true,
      title: primeViewSite.name,
      statusBarStyle: "black-translucent",
    },
    keywords: [
      "window cleaning West London",
      "window cleaning North London",
      "gutter cleaning London",
      "fascia and soffit cleaning",
      "conservatory roof cleaning",
      "solar panel cleaning London",
    ],
    alternates: { canonical: primeViewSite.canonicalUrl },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: "en_GB",
      url: primeViewSite.canonicalUrl,
      siteName: primeViewSite.name,
      title: primeViewSite.title,
      description: primeViewSite.description,
      images: [
        {
          url: primeViewSite.openGraphImageUrl,
          width: 1200,
          height: 630,
          alt: "PrimeView Window Care exterior cleaning in West and North London",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: primeViewSite.title,
      description: primeViewSite.description,
      images: [primeViewSite.openGraphImageUrl],
    },
  };
}

export const dynamic = "force-dynamic";

const phoneDisplay = primeViewSite.telephoneDisplay;
const phoneHref = primeViewSite.telephone;
const email = primeViewSite.email;
const whatsappUrl = "https://wa.me/447500338585";
const primeViewJsonLd = JSON.stringify(primeViewStructuredData).replace(/</g, "\\u003c");

const services = [
  {
    title: "Window Cleaning",
    description: "Streak-free windows for homes, shops and business premises, finished with care.",
    icon: PanelsTopLeft,
    image: "/primeview/services/window-cleaning.webp",
    imageAlt: "Professional window cleaning at a home",
  },
  {
    title: "Fascia & Soffit Cleaning",
    description: "A careful refresh for fascias, soffits, cladding and trims around your home.",
    icon: House,
    image: "/primeview/services/fascia-soffit-cleaning.webp",
    imageAlt: "Professional fascia and soffit cleaning at a home",
  },
  {
    title: "Conservatory Roof Cleaning",
    description: "Restore light and clarity to conservatory roofs, glass and surrounding frames.",
    icon: Sparkles,
    image: "/primeview/services/conservatory-roof-cleaning.webp",
    imageAlt: "Professional cleaning of a conservatory roof",
  },
  {
    title: "Gutter Cleaning",
    description: "Clear gutters and downpipes to help protect your home from overflowing rainwater.",
    icon: Droplets,
    image: "/primeview/services/gutter-cleaning.webp",
    imageAlt: "Professional gutter cleaning at a home",
  },
  {
    title: "Driveway & Patio Cleaning",
    description: "Pressure washing for driveways, patios, paths and outdoor areas that need a fresh start.",
    icon: Wrench,
    image: "/primeview/services/driveway-patio-cleaning.webp",
    imageAlt: "Professional pressure washing of a driveway and patio",
  },
  {
    title: "Solar Panel Cleaning",
    description: "A safe, specialist clean that helps keep your solar panels performing well.",
    icon: Sun,
    image: "/primeview/services/solar-panel-cleaning.webp",
    imageAlt: "Professional solar panel cleaning at a home",
  },
];

const reasons = [
  "Professional, reliable service",
  "Homes and businesses across London",
  "Clear communication from quote to completion",
  "Free, no-obligation quotes",
];

export default async function PrimeViewDemoPage() {
  const [reviews, reviewSummary] = await Promise.all([
    getPublishedWebsiteReviews(primeViewWorkspaceSlug),
    getPublishedWebsiteReviewSummary(primeViewWorkspaceSlug),
  ]);

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-[#09183a]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: primeViewJsonLd }} />
      <div className="bg-[#06183b] px-5 py-2 text-center text-xs font-bold tracking-wide text-white sm:text-sm">
        <span className="text-[#cbd5e1]">West & North London&apos;s exterior cleaning specialists</span>
        <a href={`tel:${phoneHref}`} className="ml-3 text-white underline decoration-[#9fb4d8] underline-offset-4 hover:text-[#dbeafe]">
          Call {phoneDisplay}
        </a>
      </div>

      <section id="home" className="relative isolate overflow-hidden bg-[#06183b] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_10%,rgba(44,91,181,.58),transparent_28%),radial-gradient(circle_at_70%_82%,rgba(21,57,126,.8),transparent_37%),linear-gradient(135deg,#020d26_0%,#061b45_52%,#0b2d6d_100%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:64px_64px]" />

        <header className="relative z-20 mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a href="#home" className="flex shrink-0 items-center" aria-label="PrimeView Window Care home">
            <Image
              src="/brand/primeview-window-care-logo.jpeg"
              alt="PrimeView Window Care"
              width={1242}
              height={1173}
              priority
              className="h-[74px] w-[79px] rounded-2xl border border-white/25 object-cover shadow-[0_12px_28px_rgba(0,0,0,.32)] sm:h-[86px] sm:w-[92px]"
            />
          </a>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-100 lg:flex" aria-label="Main navigation">
            <a href="#home" className="transition hover:text-white motion-reduce:transition-none">Home</a>
            <a href="#services" className="flex items-center gap-1 transition hover:text-white motion-reduce:transition-none">Services <ChevronDown className="size-4" aria-hidden="true" /></a>
            <a href="#why-us" className="transition hover:text-white motion-reduce:transition-none">Why PrimeView</a>
            <a href="#areas" className="transition hover:text-white motion-reduce:transition-none">Service Areas</a>
            <a href="#reviews" className="transition hover:text-white motion-reduce:transition-none">Reviews</a>
            <a href="#quote" className="transition hover:text-white motion-reduce:transition-none">Contact</a>
          </nav>

          <div className="flex items-center gap-2">
            <a href={`tel:${phoneHref}`} className="hidden items-center gap-2 rounded-xl border border-white/35 px-4 py-3 text-sm font-extrabold text-white transition hover:border-white hover:bg-white/10 sm:inline-flex motion-reduce:transition-none">
              <Phone className="size-4" aria-hidden="true" /> {phoneDisplay}
            </a>
            <a href="#quote" className="inline-flex items-center gap-2 rounded-xl bg-[#0a3c8f] px-4 py-3 text-sm font-black !text-white shadow-[0_10px_25px_rgba(0,0,0,.2)] transition hover:-translate-y-0.5 hover:bg-[#061b42] sm:px-5 motion-reduce:transform-none motion-reduce:transition-none" style={{ color: "#ffffff" }}>
              Free Quote <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </header>

        <details className="relative z-20 mx-5 border-t border-white/20 py-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-bold text-white">Menu</summary>
          <nav className="grid gap-3 pt-4 text-sm font-semibold" aria-label="Mobile navigation">
            <a href="#services">Services</a>
            <a href="#why-us">Why PrimeView</a>
            <a href="#areas">Service Areas</a>
            <a href="#reviews">Reviews</a>
            <a href="#quote">Contact</a>
          </nav>
        </details>

        <div className="relative z-10 mx-auto grid min-h-[590px] max-w-[1320px] items-center gap-10 px-5 pb-16 pt-12 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.13em] text-[#dbeafe] backdrop-blur-sm">
              <ShieldCheck className="size-4 text-white" aria-hidden="true" /> Professional exterior cleaning
            </div>
            <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-.045em] text-white sm:text-6xl lg:text-7xl">
              Window, gutter &amp; exterior cleaning in <span className="text-[#b8ceff]">West &amp; North London.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200 sm:text-xl">
              Reliable window, gutter, fascia, conservatory, patio and solar panel cleaning for homes and businesses across West & North London.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#quote" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a3c8f] px-6 py-4 font-black !text-white shadow-[0_12px_24px_rgba(0,0,0,.22)] transition hover:-translate-y-0.5 hover:bg-[#061b42] motion-reduce:transform-none motion-reduce:transition-none" style={{ color: "#ffffff" }}>
                Request a Free Quote <ArrowRight className="size-5" aria-hidden="true" />
              </a>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/10 px-6 py-4 font-extrabold text-white backdrop-blur-sm transition hover:bg-white/20 motion-reduce:transition-none">
                <MessageCircle className="size-5" aria-hidden="true" /> WhatsApp Us
              </a>
            </div>

            <div className="mt-9 grid max-w-xl gap-4 border-t border-white/20 pt-6 sm:grid-cols-3">
              {[
                { icon: CirclePoundSterling, title: "Fair pricing", text: "Clear quotes, no pressure" },
                { icon: CalendarCheck2, title: "Flexible visits", text: "A time that suits you" },
                { icon: Star, title: "Careful finish", text: "Attention to every detail" },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-3">
                  <Icon className="mt-0.5 size-7 shrink-0 text-[#b8ceff]" strokeWidth={1.7} aria-hidden="true" />
                  <div>
                    <p className="font-extrabold text-white">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-300">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="justify-self-center lg:justify-self-end">
            <div className="relative rounded-[2rem] border border-white/25 bg-white/10 p-3 shadow-[0_28px_65px_rgba(0,0,0,.38)] backdrop-blur-sm">
              <Image
                src="/brand/primeview-window-care-logo.jpeg"
                alt="PrimeView Window Care emblem"
                width={1242}
                height={1173}
                className="aspect-square w-full max-w-[355px] rounded-[1.45rem] object-cover"
              />
              <div className="absolute -bottom-4 -left-4 rounded-2xl bg-white px-4 py-3 shadow-xl">
                <p className="text-xs font-black uppercase tracking-[.12em] text-[#436295]">PrimeView</p>
                <p className="mt-1 text-sm font-black text-[#071b42]">Window Care</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section id="services" className="mx-auto max-w-[1320px] px-5 py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-black uppercase tracking-[.18em] text-[#315997]">Our services</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-.03em] text-[#071b42] sm:text-4xl">Everything outside, taken care of.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">A practical, professional clean for the parts of your property that make the first impression.</p>
            </div>
            <a href="#quote" className="inline-flex w-fit items-center gap-2 font-black text-[#0a3478] underline decoration-[#9fb4d8] decoration-2 underline-offset-8 hover:text-[#06183b]">
              Get a quote for your property <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map(({ title, description, icon: Icon, image }) => (
              <article key={title} className="group relative isolate flex min-h-[292px] flex-col overflow-hidden rounded-2xl border border-[#183b79] bg-[#06183b] p-6 text-white shadow-[0_12px_32px_rgba(16,37,80,.16)] transition hover:-translate-y-1 hover:border-[#7da7f2] hover:shadow-[0_20px_42px_rgba(16,37,80,.25)] motion-reduce:transform-none motion-reduce:transition-none">
                <div aria-hidden="true" className="absolute inset-0 -z-20 bg-cover bg-center brightness-[.78] transition duration-500 group-hover:brightness-110 motion-reduce:transition-none" style={{ backgroundImage: `url("${image}")` }} />
                <div className="absolute inset-0 -z-10 bg-[linear-gradient(145deg,rgba(2,13,38,.94)_0%,rgba(6,24,59,.82)_54%,rgba(10,60,143,.65)_100%)] transition group-hover:bg-[linear-gradient(145deg,rgba(2,13,38,.84)_0%,rgba(6,24,59,.66)_54%,rgba(10,60,143,.48)_100%)] motion-reduce:transition-none" />
                <div className="grid size-12 place-items-center rounded-xl border border-white/25 bg-white/15 text-white backdrop-blur-sm">
                  <Icon className="size-6" strokeWidth={1.7} aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-xl font-black tracking-tight text-white">{title}</h3>
                <p className="mt-3 max-w-sm leading-6 text-slate-100">{description}</p>
                <a href="#quote" className="mt-auto pt-6 text-sm font-black text-white underline decoration-[#b8ceff] decoration-2 underline-offset-4 transition group-hover:text-[#dbeafe]">Request a quote <ArrowRight className="ml-1 inline size-4" aria-hidden="true" /></a>
              </article>
            ))}
          </div>
        </section>

        <section id="why-us" className="bg-[#06183b] px-5 py-20 text-white lg:px-8">
          <div className="mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-[.92fr_1.08fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[.18em] text-[#b8ceff]">Why PrimeView</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-.035em] sm:text-4xl">A service you can feel confident booking.</h2>
              <p className="mt-5 max-w-lg leading-7 text-slate-300">From first contact to the final check, PrimeView keeps the process simple, respectful and focused on a high-quality result.</p>
              <a href={`tel:${phoneHref}`} className="mt-8 inline-flex items-center gap-2 font-black text-white underline decoration-[#9fb4d8] decoration-2 underline-offset-8 hover:text-[#dbeafe]">
                <Phone className="size-4" aria-hidden="true" /> Speak to PrimeView: {phoneDisplay}
              </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {reasons.map((reason) => (
                <div key={reason} className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/8 p-5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#b8ceff] text-[#06183b]"><Check className="size-5" strokeWidth={3} aria-hidden="true" /></span>
                  <p className="font-extrabold leading-6">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="areas" className="px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-[1320px] gap-8 rounded-3xl border border-[#d9e0ed] bg-white p-8 shadow-[0_14px_40px_rgba(16,37,80,.07)] md:grid-cols-[auto_1fr_auto] md:items-center md:p-10">
            <div className="grid size-14 place-items-center rounded-2xl bg-[#eaf0fc] text-[#0a3c8f]"><MapPin className="size-7" aria-hidden="true" /></div>
            <div>
              <p className="text-sm font-black uppercase tracking-[.16em] text-[#315997]">Service area</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[#071b42]">West & North London</h2>
              <p className="mt-2 max-w-2xl leading-6 text-slate-600">Not sure whether you&apos;re in our area? Send your postcode and we&apos;ll let you know.</p>
            </div>
            <a href="#quote" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a3c8f] px-5 py-3.5 text-sm font-black !text-white transition hover:bg-[#061b42] motion-reduce:transition-none" style={{ color: "#ffffff" }}>Check your area <ArrowRight className="size-4" aria-hidden="true" /></a>
          </div>
        </section>

        <section id="reviews" className="bg-[#eef3fc] px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-[1320px]">
            <div className="max-w-2xl">
              <p className="text-sm font-black uppercase tracking-[.18em] text-[#315997]">Verified customer reviews</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-.03em] text-[#071b42] sm:text-4xl">Feedback linked to completed services.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">Read verified feedback from customers after a completed PrimeView service. Every public review is linked to a secure invitation and checked before publication.</p>
              {reviewSummary.count > 0 && reviewSummary.averageRating !== null ? (
                <div className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-full border border-[#c9d8ef] bg-white px-4 py-2 text-sm font-black text-[#071b42] shadow-sm">
                  <Star className="size-4 fill-current text-[#b17815]" aria-hidden="true" />
                  {reviewSummary.averageRating.toFixed(1)} / 5
                  <span className="font-semibold text-slate-500">· {reviewSummary.count} verified {reviewSummary.count === 1 ? "review" : "reviews"}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
              <div className="grid gap-4 sm:grid-cols-2">
                {reviews.length ? reviews.map((review) => (
                  <article key={review.id} className="flex flex-col rounded-2xl border border-[#d7e1f2] bg-white p-6 shadow-[0_12px_28px_rgba(16,37,80,.07)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1 text-[#b17815]" aria-label={`${review.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }, (_, index) => <Star key={index} className="size-4" fill={index < review.rating ? "currentColor" : "none"} aria-hidden="true" />)}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {review.isFeatured ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7e5] px-2.5 py-1 text-xs font-black text-[#805d14]">
                            <Sparkles className="size-3.5" aria-hidden="true" /> Featured
                          </span>
                        ) : null}
                        {review.isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5eb] px-2.5 py-1 text-xs font-black text-[#17452f]">
                            <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified customer
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-4 flex-1 leading-7 text-slate-700">“{review.message}”</p>
                    {review.ownerReply ? (
                      <div className="mt-4 rounded-2xl border border-[#d7e1f2] bg-[#f6f9ff] p-4">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#315997]">
                          <MessageSquareReply className="size-4" aria-hidden="true" /> PrimeView reply
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{review.ownerReply}</p>
                      </div>
                    ) : null}
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <p className="font-black text-[#071b42]">{review.reviewerName}</p>
                      <p className="mt-1 text-sm text-slate-500">{[review.service, review.area].filter(Boolean).join(" · ") || "PrimeView customer"}</p>
                    </div>
                  </article>
                )) : (
                  <article className="sm:col-span-2 rounded-2xl border border-dashed border-[#b9c9e4] bg-white/75 p-7 text-slate-600">
                    <p className="font-black text-[#071b42]">Verified reviews will appear here.</p>
                    <p className="mt-2 max-w-xl leading-7">PrimeView publishes feedback linked to completed services after moderation.</p>
                  </article>
                )}
              </div>

              <aside className="rounded-3xl border border-[#cbd9ef] bg-white p-6 shadow-[0_18px_42px_rgba(16,37,80,.1)] sm:p-8">
                <p className="text-sm font-black uppercase tracking-[.16em] text-[#315997]">Verified reviews</p>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-[#071b42]">Completed a service with us?</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">PrimeView sends a secure single-use review link after a completed service. Reviews cannot be submitted anonymously from this website.</p>
                <div className="mt-6"><PrimeViewReviewForm serviceOptions={services.map((service) => service.title)} /></div>
              </aside>
            </div>
          </div>
        </section>

        <section id="quote" className="bg-white px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-[1120px] overflow-hidden rounded-3xl border border-[#d9e0ed] shadow-[0_22px_60px_rgba(16,37,80,.12)] lg:grid-cols-[.82fr_1.18fr]">
            <div className="bg-[linear-gradient(150deg,#06183b,#0b347c)] p-8 text-white md:p-11">
              <p className="text-sm font-black uppercase tracking-[.18em] text-[#b8ceff]">Free quote</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-.035em]">Tell us what needs cleaning.</h2>
              <p className="mt-5 leading-7 text-slate-200">Send your details and PrimeView Window Care will come back to you with a clear, no-obligation quote.</p>
              <div className="mt-10 space-y-5 text-sm font-bold">
                <a href={`tel:${phoneHref}`} className="flex items-center gap-3 transition hover:text-[#dbeafe]"><Phone className="size-5 text-[#b8ceff]" aria-hidden="true" /> {phoneDisplay}</a>
                <a href={`mailto:${email}`} className="flex items-center gap-3 transition hover:text-[#dbeafe]"><Mail className="size-5 text-[#b8ceff]" aria-hidden="true" /> {email}</a>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 transition hover:text-[#dbeafe]"><MessageCircle className="size-5 text-[#b8ceff]" aria-hidden="true" /> WhatsApp PrimeView</a>
              </div>
            </div>
            <PrimeViewQuoteForm serviceOptions={services.map((service) => service.title)} />
          </div>
        </section>
      </main>

      <footer className="bg-[#030f28] px-5 py-10 text-slate-300 lg:px-8">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-white">PrimeView Window Care</p>
            <p className="mt-1">Professional exterior cleaning across West & North London.</p>
          </div>
          <div className="flex gap-5 font-bold">
            <a href={`tel:${phoneHref}`} className="hover:text-white">Call</a>
            <a href={`mailto:${email}`} className="hover:text-white">Email</a>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
