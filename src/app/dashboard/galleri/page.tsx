import { redirect } from "next/navigation";
import { ImageIcon, Upload, Video } from "lucide-react";

import { getDashboardGalleryItems, updateGalleryItem } from "@/lib/website-gallery-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

async function galleryAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "") as "publish" | "hide" | "delete";
  if (!id || !["publish", "hide", "delete"].includes(action) || !(await updateGalleryItem(id, action))) redirect("/dashboard/galleri?error=1");
  redirect("/dashboard/galleri?updated=1");
}

export default async function GalleryManagerPage({ searchParams }: { searchParams?: Promise<{ uploaded?: string; updated?: string; error?: string }> }) {
  const [access, items, query] = await Promise.all([getUserWorkspaceAccess(), getDashboardGalleryItems(), searchParams ?? Promise.resolve({})]);
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");

  return <div className="grid gap-6">
    <section className="rounded-[28px] bg-[#142b20] p-6 text-white shadow-xl sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b7d5c1]">Website media</p>
      <h1 className="mt-3 text-3xl font-black">Gallery manager</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d9e7dd]">Upload photos and videos, choose how they should appear and publish them without a new website deployment.</p>
    </section>

    {query.uploaded === "1" ? <p className="rounded-2xl bg-[#eef8f1] p-4 font-semibold text-[#17452f]">Media uploaded as a draft.</p> : null}
    {query.updated === "1" ? <p className="rounded-2xl bg-[#eef8f1] p-4 font-semibold text-[#17452f]">Gallery updated.</p> : null}
    {query.error === "1" ? <p className="rounded-2xl bg-[#fff4f1] p-4 font-semibold text-[#8f2f1b]">The change could not be saved.</p> : null}

    <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><Upload className="size-6 text-[#17452f]"/><div><h2 className="text-xl font-black">Upload media</h2><p className="text-sm text-[#667168]">Images up to 8 MB. Videos up to 40 MB.</p></div></div>
      <form action="/api/dashboard/gallery/upload" method="post" encType="multipart/form-data" className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">File<input required name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime" className="rounded-xl border border-[#d8dfd6] p-3"/></label>
        <label className="grid gap-2 text-sm font-bold">Display style<select name="display_style" className="min-h-12 rounded-xl border border-[#d8dfd6] px-3"><option value="grid">Simple grid</option><option value="masonry">Masonry</option><option value="slider">Slider</option><option value="hero">Large banner</option><option value="video">Video card</option></select></label>
        <label className="grid gap-2 text-sm font-bold">Title<input name="title" maxLength={120} className="min-h-12 rounded-xl border border-[#d8dfd6] px-3"/></label>
        <label className="grid gap-2 text-sm font-bold">Alt text<input name="alt_text" maxLength={180} placeholder="Describe what is visible" className="min-h-12 rounded-xl border border-[#d8dfd6] px-3"/></label>
        <label className="grid gap-2 text-sm font-bold lg:col-span-2">Caption<textarea name="caption" maxLength={500} rows={3} className="rounded-xl border border-[#d8dfd6] p-3"/></label>
        <button className="min-h-12 w-fit rounded-xl bg-[#173e2b] px-6 font-black text-white">Upload as draft</button>
      </form>
    </section>

    <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-black">Media library</h2>
      {items.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#e1e7df]">
        <div className="aspect-video bg-[#edf1ec]">{item.mediaType === "image" ? <img src={item.publicUrl} alt={item.altText} loading="lazy" className="h-full w-full object-cover"/> : <video src={item.publicUrl} controls preload="metadata" className="h-full w-full object-cover"/>}</div>
        <div className="p-4"><div className="flex items-center justify-between gap-3"><p className="font-black">{item.title || "Untitled media"}</p><span className="rounded-full bg-[#edf3ee] px-2 py-1 text-xs font-bold">{item.status}</span></div><p className="mt-2 text-xs text-[#667168]">{item.displayStyle} · {item.mediaType}</p>
        <form action={galleryAction} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="id" value={item.id}/>{item.status !== "published" ? <button name="action" value="publish" className="rounded-lg bg-[#173e2b] px-3 py-2 text-sm font-bold text-white">Publish</button> : <button name="action" value="hide" className="rounded-lg border px-3 py-2 text-sm font-bold">Hide</button>}<button name="action" value="delete" className="rounded-lg border border-[#efc8c0] px-3 py-2 text-sm font-bold text-[#8f2f1b]">Delete</button></form></div>
      </article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed p-8 text-center text-[#667168]"><ImageIcon className="mx-auto size-8"/><p className="mt-3">No media uploaded yet.</p></div>}
    </section>
  </div>;
}