import type { Metadata } from "next";
import Link from "next/link";

import { primeViewWorkspaceSlug } from "@/features/primeview/review";
import { getPublishedGalleryItems } from "@/lib/website-gallery-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery | PrimeView Window Care",
  description: "See recent window, gutter, exterior and pressure-cleaning work completed by PrimeView Window Care.",
};

export default async function PrimeViewGalleryPage() {
  const items = await getPublishedGalleryItems(primeViewWorkspaceSlug);
  const sliderItems = items.filter((item) => item.displayStyle === "slider");
  const hero = items.find((item) => item.displayStyle === "hero" || item.isFeatured);
  const gridItems = items.filter((item) => item.id !== hero?.id && item.displayStyle !== "slider");

  return <main className="min-h-screen bg-[#f4f6fb] text-[#09183a]">
    <header className="bg-[#06183b] text-white"><div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-5 lg:px-8"><Link href="/demo/primeview" className="text-xl font-black">PrimeView Window Care</Link><Link href="/demo/primeview#quote" className="rounded-xl bg-[#0a3c8f] px-4 py-3 text-sm font-black text-white">Free quote</Link></div></header>
    <section className="mx-auto max-w-[1320px] px-5 py-14 lg:px-8"><p className="text-sm font-black uppercase tracking-[.15em] text-[#315ea8]">Our work</p><h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">PrimeView project gallery</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#52617e]">Photos and videos uploaded directly by the PrimeView team.</p></section>

    {hero ? <section className="mx-auto max-w-[1320px] px-5 pb-8 lg:px-8"><article className="overflow-hidden rounded-[28px] bg-[#06183b] text-white shadow-xl">{hero.mediaType === "image" ? <img src={hero.publicUrl} alt={hero.altText} className="max-h-[650px] w-full object-cover"/> : <video src={hero.publicUrl} controls preload="metadata" className="max-h-[650px] w-full object-cover"/>}<div className="p-6 sm:p-8"><h2 className="text-2xl font-black">{hero.title || "Featured project"}</h2>{hero.caption ? <p className="mt-2 text-slate-200">{hero.caption}</p> : null}</div></article></section> : null}

    {sliderItems.length ? <section className="mx-auto max-w-[1320px] px-5 pb-10 lg:px-8"><div className="flex snap-x gap-5 overflow-x-auto pb-4">{sliderItems.map(item => <article key={item.id} className="min-w-[82%] snap-center overflow-hidden rounded-3xl bg-white shadow-sm sm:min-w-[48%] lg:min-w-[31%]">{item.mediaType === "image" ? <img src={item.publicUrl} alt={item.altText} loading="lazy" className="aspect-[4/3] w-full object-cover"/> : <video src={item.publicUrl} controls preload="metadata" className="aspect-[4/3] w-full object-cover"/>}<div className="p-5"><h2 className="font-black">{item.title || "Completed project"}</h2>{item.caption ? <p className="mt-2 text-sm text-[#52617e]">{item.caption}</p> : null}</div></article>)}</div></section> : null}

    <section className="mx-auto max-w-[1320px] px-5 pb-20 lg:px-8">{gridItems.length ? <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">{gridItems.map(item => <article key={item.id} className="mb-5 break-inside-avoid overflow-hidden rounded-3xl bg-white shadow-sm">{item.mediaType === "image" ? <img src={item.publicUrl} alt={item.altText} loading="lazy" className="w-full object-cover"/> : <video src={item.publicUrl} controls preload="metadata" className="w-full"/>}<div className="p-5"><h2 className="font-black">{item.title || "PrimeView project"}</h2>{item.caption ? <p className="mt-2 text-sm leading-6 text-[#52617e]">{item.caption}</p> : null}</div></article>)}</div> : <div className="rounded-3xl border border-dashed border-[#bcc8dc] bg-white p-12 text-center"><h2 className="text-2xl font-black">Gallery coming soon</h2><p className="mt-3 text-[#52617e]">New project photos and videos will appear here after publication.</p></div>}</section>
  </main>;
}