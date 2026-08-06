import type { GalleryItem } from "@/lib/website-gallery-db";

type PublicWorkspaceGalleryProps = {
  items: GalleryItem[];
  companyName: string;
  workspaceSlug: string;
  compact?: boolean;
};

function Media({ item, className }: { item: GalleryItem; className: string }) {
  return item.mediaType === "video" ? (
    <video src={item.publicUrl} controls preload="metadata" playsInline className={className} />
  ) : (
    <img src={item.publicUrl} alt={item.altText} loading="lazy" className={className} />
  );
}

export function PublicWorkspaceGallery({ items, companyName, workspaceSlug, compact = false }: PublicWorkspaceGalleryProps) {
  if (!items.length) return null;

  const hero = items.find((item) => item.isFeatured || item.displayStyle === "hero");
  const sliderItems = items.filter((item) => item.displayStyle === "slider" && item.id !== hero?.id);
  const gridItems = items.filter((item) => item.id !== hero?.id && item.displayStyle !== "slider");

  if (compact) {
    const previewItems = [hero, ...items.filter((item) => item.id !== hero?.id)].filter(Boolean).slice(0, 6) as GalleryItem[];
    return (
      <section className="mx-auto mt-6 max-w-5xl rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/10 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#68736b]">Galleri / Gallery</p><h2 className="mt-2 text-2xl font-black text-[#17201a]">Se arbeten från {companyName}</h2></div>
          <a href={`/galleri/${workspaceSlug}`} className="rounded-xl bg-[#173e2b] px-4 py-3 text-sm font-black text-white">Visa hela galleriet</a>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {previewItems.map((item, index) => <article key={item.id} className={`overflow-hidden rounded-2xl bg-[#edf1ec] ${index === 0 ? "col-span-2 row-span-2 md:col-span-1" : ""}`}><Media item={item} className="aspect-square h-full w-full object-cover" /></article>)}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] text-[#17201a]">
      <header className="bg-[#173e2b] text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5"><a href={`/boka/${workspaceSlug}`} className="text-lg font-black sm:text-xl">{companyName}</a><a href={`/boka/${workspaceSlug}`} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-[#173e2b]">Boka / Book</a></div></header>
      <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16"><p className="text-xs font-black uppercase tracking-[.18em] text-[#637068]">Galleri / Gallery</p><h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">Arbeten från {companyName}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[#667168]">Publicerade bilder och videor från verksamheten.</p></section>

      {hero ? <section className="mx-auto max-w-6xl px-5 pb-8"><article className="overflow-hidden rounded-[2rem] bg-[#173e2b] text-white shadow-xl"><Media item={hero} className="max-h-[680px] w-full object-cover" /><div className="p-6 sm:p-8"><h2 className="text-2xl font-black">{hero.title || "Utvalt arbete"}</h2>{hero.caption ? <p className="mt-2 max-w-3xl text-white/75">{hero.caption}</p> : null}</div></article></section> : null}

      {sliderItems.length ? <section className="mx-auto max-w-6xl overflow-x-auto px-5 pb-8"><div className="flex min-w-max gap-4">{sliderItems.map((item) => <article key={item.id} className="w-[78vw] max-w-xl overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/10"><Media item={item} className="aspect-video w-full object-cover" /><div className="p-5"><h2 className="font-black">{item.title || "Projekt"}</h2>{item.caption ? <p className="mt-2 text-sm leading-6 text-[#667168]">{item.caption}</p> : null}</div></article>)}</div></section> : null}

      <section className="mx-auto max-w-6xl px-5 pb-20">{gridItems.length ? <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">{gridItems.map((item) => <article key={item.id} className="mb-5 break-inside-avoid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/10"><Media item={item} className="w-full object-cover" /><div className="p-5"><h2 className="font-black">{item.title || "Projekt"}</h2>{item.caption ? <p className="mt-2 text-sm leading-6 text-[#667168]">{item.caption}</p> : null}</div></article>)}</div> : <div className="rounded-3xl border border-dashed p-12 text-center text-[#667168]">Inga fler publicerade medier.</div>}</section>
    </main>
  );
}
