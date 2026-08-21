import type { Metadata } from "next";
import Link from "next/link";

import { guestFlowLocaleFrom, type GuestFlowLocale } from "../../svara/[token]/guest-flow-locale";
import { guestQuoteTestCopy, guestQuoteTestHref } from "./guest-test-locale";
import { getMarketplaceGuestQuoteTestView } from "@/lib/marketplace-guest-quote-test";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = guestFlowLocaleFrom(query?.lang);
  return { title: guestQuoteTestCopy[locale].metadataTitle, robots: { index: false, follow: false } };
}

export default async function MarketplaceGuestQuoteTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = guestFlowLocaleFrom(query?.lang);
  const text = guestQuoteTestCopy[locale];
  const alternativeLocale: GuestFlowLocale = locale === "en" ? "sv" : "en";
  const view = getMarketplaceGuestQuoteTestView(token);

  if (!view) {
    return (
      <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex justify-end"><Link href={guestQuoteTestHref(token, alternativeLocale)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
          <h1 className="mt-4 text-3xl font-bold text-[#17201a]">{text.unavailableTitle}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.unavailableBody}</p>
        </section>
      </main>
    );
  }

  return (
    <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 text-[#17201a] sm:px-6">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-10">
        <div className="flex justify-end"><Link href={guestQuoteTestHref(token, alternativeLocale)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[#4c745a]">{text.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold">{text.title}</h1>
        <p className="mt-4 leading-7 text-[#5b665f]">
          {text.body}
        </p>
        <dl className="mt-7 rounded-2xl bg-[#f7f9f7] p-5 text-sm">
          <div className="grid gap-1 sm:grid-cols-[11rem_1fr]"><dt className="font-bold">{text.expiry}</dt><dd>{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(view.expiresAt))}</dd></div>
        </dl>
      </section>
    </main>
  );
}
