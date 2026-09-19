import { redirect } from "next/navigation";
import { ImageIcon, Images, Upload } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardGalleryItems, updateGalleryItem } from "@/lib/website-gallery-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

type GallerySearchParams = {
  uploaded?: string | string[];
  updated?: string | string[];
  error?: string | string[];
  lang?: string | string[];
};

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

async function galleryAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "") as "publish" | "hide" | "delete";
  const isEnglish = String(formData.get("lang") ?? "") === "en";

  if (!id || !["publish", "hide", "delete"].includes(action) || !(await updateGalleryItem(id, action))) {
    redirect(localizedHref("/dashboard/galleri?error=1", isEnglish));
  }
  redirect(localizedHref("/dashboard/galleri?updated=1", isEnglish));
}

export default async function GalleryManagerPage({ searchParams }: { searchParams?: Promise<GallerySearchParams> }) {
  const [access, items, query] = await Promise.all([
    getUserWorkspaceAccess(),
    getDashboardGalleryItems(),
    searchParams ?? Promise.resolve({} as GallerySearchParams),
  ]);

  const value = (key: keyof GallerySearchParams) => {
    const current = query[key];
    return Array.isArray(current) ? current[0] : current;
  };
  const isEnglish = value("lang") === "en";

  if (!access.ok || !canManageWorkspaceSettings(access)) {
    redirect(localizedHref("/dashboard", isEnglish));
  }

  const publishedCount = items.filter((item) => item.status === "published").length;
  const draftCount = items.filter((item) => item.status !== "published").length;

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow={isEnglish ? "Website media" : "Webbplatsmedia"}
        title={isEnglish ? "Gallery manager" : "Gallerihantering"}
        description={
          isEnglish
            ? "Upload photos and videos, decide how they appear and publish them without a new website deployment."
            : "Ladda upp bilder och videor, välj hur de ska visas och publicera dem utan en ny webbplatsdistribution."
        }
        icon={Images}
      />

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-label={isEnglish ? "Gallery status" : "Galleristatus"}>
        <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <article className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{isEnglish ? "Media items" : "Mediaobjekt"}</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-ink">{items.length}</p>
          </article>
          <article className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{isEnglish ? "Published" : "Publicerade"}</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-ink">{publishedCount}</p>
          </article>
          <article className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{isEnglish ? "Draft / hidden" : "Utkast / dolda"}</p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-ink">{draftCount}</p>
          </article>
        </div>
      </section>

      {value("uploaded") === "1" ? <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 font-semibold text-[#087754]">{isEnglish ? "Media uploaded as a draft." : "Media laddades upp som utkast."}</p> : null}
      {value("updated") === "1" ? <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 font-semibold text-[#087754]">{isEnglish ? "Gallery updated." : "Galleriet uppdaterades."}</p> : null}
      {value("error") ? <p className="rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-4 font-semibold text-danger">{isEnglish ? "The upload or gallery change could not be saved. Try again with a file under 4 MB." : "Uppladdningen eller galleriändringen kunde inte sparas. Försök igen med en fil under 4 MB."}</p> : null}

      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">{isEnglish ? "Upload media" : "Ladda upp media"}</h2>
            <p className="mt-1 text-sm text-ink-muted">{isEnglish ? "Images and short videos up to 4 MB." : "Bilder och korta videor upp till 4 MB."}</p>
          </div>
        </div>

        <form action="/api/dashboard/gallery/upload" method="post" encType="multipart/form-data" className="mt-5 grid gap-4 lg:grid-cols-2">
          <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
          <label className="grid gap-2 text-sm font-bold text-ink">
            {isEnglish ? "File" : "Fil"}
            <input required name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime" className="rounded-control border border-line bg-surface p-3" />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink">
            {isEnglish ? "Display style" : "Visningsstil"}
            <select name="display_style" className="min-h-12 rounded-control border border-line bg-surface px-3">
              <option value="grid">{isEnglish ? "Simple grid" : "Enkelt rutnät"}</option>
              <option value="masonry">Masonry</option>
              <option value="slider">Slider</option>
              <option value="hero">{isEnglish ? "Large banner" : "Stor banner"}</option>
              <option value="video">{isEnglish ? "Video card" : "Videokort"}</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink">
            {isEnglish ? "Title" : "Titel"}
            <input name="title" maxLength={120} className="min-h-12 rounded-control border border-line bg-surface px-3" />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink">
            {isEnglish ? "Alt text" : "Alternativtext"}
            <input
              name="alt_text"
              maxLength={180}
              placeholder={isEnglish ? "Describe what is visible" : "Beskriv vad som syns"}
              className="min-h-12 rounded-control border border-line bg-surface px-3"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink lg:col-span-2">
            {isEnglish ? "Caption" : "Bildtext"}
            <textarea name="caption" maxLength={500} rows={3} className="rounded-control border border-line bg-surface p-3" />
          </label>

          <button className="min-h-11 w-fit rounded-control bg-brand-deep px-5 font-bold text-white transition hover:bg-brand-hover">
            {isEnglish ? "Upload as draft" : "Ladda upp som utkast"}
          </button>
        </form>
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Library" : "Bibliotek"}</p>
            <h2 className="mt-1 text-lg font-bold text-ink">{isEnglish ? "Media library" : "Mediabibliotek"}</h2>
          </div>
          <span className="text-xs font-bold text-ink-muted">{items.length} {isEnglish ? "items" : "objekt"}</span>
        </div>

        {items.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-card border border-line bg-surface-subtle">
                <div className="aspect-video bg-surface-subtle">
                  {item.mediaType === "image" ? (
                    // Gallery items are runtime workspace uploads and may live on Blob/CDN hosts.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.publicUrl} alt={item.altText} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <video src={item.publicUrl} controls preload="metadata" className="h-full w-full object-cover" />
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-ink">{item.title || (isEnglish ? "Untitled media" : "Media utan titel")}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "published" ? "bg-[#eaf8f2] text-[#087754]" : "bg-[#eef5ff] text-brand"}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">{item.displayStyle} · {item.mediaType}</p>

                  <form action={galleryAction} className="mt-4 flex flex-wrap gap-2">
                    <input type="hidden" name="lang" value={isEnglish ? "en" : "sv"} />
                    <input type="hidden" name="id" value={item.id} />
                    {item.status !== "published" ? (
                      <button name="action" value="publish" className="rounded-control bg-brand-deep px-3 py-2 text-sm font-bold text-white">
                        {isEnglish ? "Publish" : "Publicera"}
                      </button>
                    ) : (
                      <button name="action" value="hide" className="rounded-control border border-line bg-surface px-3 py-2 text-sm font-bold text-brand-deep">
                        {isEnglish ? "Hide" : "Dölj"}
                      </button>
                    )}
                    <button name="action" value="delete" className="rounded-control border border-[#efc8c0] px-3 py-2 text-sm font-bold text-danger">
                      {isEnglish ? "Delete" : "Ta bort"}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-card border border-dashed border-line-strong bg-surface-subtle p-8 text-center text-ink-muted">
            <ImageIcon className="mx-auto size-8 text-brand" aria-hidden="true" />
            <p className="mt-3">{isEnglish ? "No media uploaded yet." : "Ingen media har laddats upp ännu."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
