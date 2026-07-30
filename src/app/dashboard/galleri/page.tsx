import { redirect } from "next/navigation";
import { ImageIcon, Upload } from "lucide-react";

import { getDashboardGalleryItems, updateGalleryItem } from "@/lib/website-gallery-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

type GallerySearchParams = { uploaded?: string | string[]; updated?: string | string[]; error?: string | string[]; lang?: string | string[] };

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

async function galleryAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "") as "publish" | "hide" | "delete";
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  if (!id || !["publish", "hide", "delete"].includes(action) || !(await updateGalleryItem(id, action))) redirect(localizedHref("/dashboard/galleri?error=1", isEnglish));
  redirect(localizedHref("/dashboard/galleri?updated=1", isEnglish));
}

export default async function GalleryManagerPage({ searchParams }: { searchParams?: Promise<GallerySearchParams> }) {
  const [access, items, query] = await Promise.all([getUserWorkspaceAccess(), getDashboardGalleryItems(), searchParams ?? Promise.resolve({})]);
  const value = (key: keyof GallerySearchParams) => { const current = query?.[key]; return Array.isArray(current) ? current[0] : current; };
  const isEnglish = value("lang") === "en";
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect(localizedHref("/dashboard", isEnglish));

  return <div className="grid gap-6">
    <section className="rounded-[28px] bg-[#142b20] p-6 text-white shadow-xl sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b7d5c1]">{isEnglish ? "Website media" : "Webbplatsmedia"}</p>
      <h1 className="mt-3 text-3xl font-black">{isEnglish ? "Gallery manager" : "Gallerihantering"}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d9e7dd]">{isEnglish ? "Upload photos and videos, choose how they appear and publish them without a new website deployment." : "Ladda upp bilder och videor, välj hur de ska visas och publicera dem utan en ny webbplatsdistribution."}</p>
    </section>

    {value("uploaded") === "1" ? <p className="rounded-2xl bg-[#eef8f1] p-4 font-semibold text-[#17452f]">{isEnglish ? "Media uploaded as a draft." : "Media laddades upp som utkast."}</p> : null}
    {value("updated") === "1" ? <p className="rounded-2xl bg-[#eef8f1] p-4 font-semibold text-[#17452f]">{isEnglish ? "Gallery updated." : "Galleriet uppdaterades."}</p> : null}
    {value("error") ? <p className="rounded-2xl bg-[#fff4f1] p-4 font-semibold text-[#8f2f1b]">{isEnglish ? "The upload or gallery change could not be saved. Try again with a file under 4 MB." : "Uppladdningen eller galleriändringen kunde inte sparas. Försök igen med en fil under 4 MB."}</p> : null}

    <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><Upload className="size-6 text-[#17452f]"/><div><h2 className="text-xl font-black">{isEnglish ? "Upload media" : "Ladda upp media"}</h2><p className="text-sm text-[#667168]">{isEnglish ? "Images and short videos up to 4 MB." : "Bilder och korta videor upp till 4 MB."}</p></div></div>
      <form action="/api/dashboard/gallery/upload" method="post" encType="multipart/form-data" className="mt-5 grid gap-4 lg:grid-cols-2">
        <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
        <label className="grid gap-2 text-sm font-bold">{isEnglish ? "File" : "Fil"}<input required name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime" className="rounded-xl border border-[#d8dfd6] p-3"/></label>
        <label className="grid gap-2 text-sm font-bold">{isEnglish ? "Display style" : "Visningsstil"}<select name="display_style" className="min-h-12 rounded-xl border border-[#d8dfd6] px-3"><option value="grid">{isEnglish ? "Simple grid" : "Enkelt rutnät"}</option><option value="masonry">Masonry</option><option value="slider">Slider</option><option value="hero">{isEnglish ? "Large banner" : "Stor banner"}</option><option value="video">{isEnglish ? "Video card" : "Videokort"}</option></select></label>
        <label className="grid gap-2 text-sm font-bold">{isEnglish ? "Title" : "Titel"}<input name="title" maxLength={120} className="min-h-12 rounded-xl border border-[#d8dfd6] px-3"/></label>
        <label className="grid gap-2 text-sm font-bold">{isEnglish ? "Alt text" : "Alternativtext"}<input name="alt_text" maxLength={180} placeholder={isEnglish ? "Describe what is visible" : "Beskriv vad som syns"} className="min-h-12 rounded-xl border border-[#d8dfd6] px-3"/></label>
        <label className="grid gap-2 text-sm font-bold lg:col-span-2">{isEnglish ? "Caption" : "Bildtext"}<textarea name="caption" maxLength={500} rows={3} className="rounded-xl border border-[#d8dfd6] p-3"/></label>
        <button className="min-h-12 w-fit rounded-xl bg-[#173e2b] px-6 font-black text-white">{isEnglish ? "Upload as draft" : "Ladda upp som utkast"}</button>
      </form>
    </section>

    <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-black">{isEnglish ? "Media library" : "Mediabibliotek"}</h2>
      {items.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#e1e7df]">
        <div className="aspect-video bg-[#edf1ec]">{item.mediaType === "image" ? <img src={item.publicUrl} alt={item.altText} loading="lazy" className="h-full w-full object-cover"/> : <video src={item.publicUrl} controls preload="metadata" className="h-full w-full object-cover"/>}</div>
        <div className="p-4"><div className="flex items-center justify-between gap-3"><p className="font-black">{item.title || (isEnglish ? "Untitled media" : "Media utan titel")}</p><span className="rounded-full bg-[#edf3ee] px-2 py-1 text-xs font-bold">{item.status}</span></div><p className="mt-2 text-xs text-[#667168]">{item.displayStyle} · {item.mediaType}</p>
        <form action={galleryAction} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><input type="hidden" name="id" value={item.id}/>{item.status !== "published" ? <button name="action" value="publish" className="rounded-lg bg-[#173e2b] px-3 py-2 text-sm font-bold text-white">{isEnglish ? "Publish" : "Publicera"}</button> : <button name="action" value="hide" className="rounded-lg border px-3 py-2 text-sm font-bold">{isEnglish ? "Hide" : "Dölj"}</button>}<button name="action" value="delete" className="rounded-lg border border-[#efc8c0] px-3 py-2 text-sm font-bold text-[#8f2f1b]">{isEnglish ? "Delete" : "Ta bort"}</button></form></div>
      </article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed p-8 text-center text-[#667168]"><ImageIcon className="mx-auto size-8"/><p className="mt-3">{isEnglish ? "No media uploaded yet." : "Ingen media har laddats upp ännu."}</p></div>}
    </section>
  </div>;
}
