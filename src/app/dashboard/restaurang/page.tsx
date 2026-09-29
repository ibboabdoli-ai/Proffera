import { redirect } from "next/navigation";

import {
  DONIS_FALLBACK_DISH_IMAGE_URLS,
  DONIS_FALLBACK_IMAGES,
  DONIS_FALLBACK_SITE,
} from "@/lib/donis-fallback";
import { getRestaurantAdmin } from "@/lib/restaurant-site-db";
import { getDashboardGalleryItems } from "@/lib/website-gallery-db";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";
import { RestaurantEditor } from "./restaurant-editor";

export const dynamic = "force-dynamic";

export default async function RestaurantAdminPage() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  const site = await getRestaurantAdmin();
  if (!site) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <section className="rounded-2xl border border-[#d9cfc1] bg-[#f8f3ea] p-5 text-[#221d19] shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden="true"
              className="h-14 w-28 shrink-0 rounded-xl bg-[#f6ead6]"
              style={{
                backgroundImage: "url('/donis-logo.png')",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "84% auto",
              }}
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#8a493a]">
                Doni’s Trattoria
              </p>
              <h1 className="mt-1 font-serif text-3xl">Restaurang</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-[#665b50]">
            Ingen restaurangwebbplats är kopplad till den här arbetsytan. Kontakta
            Proffera för att koppla ägarens arbetsyta.
          </p>
          <a
            href="/demo/donis-trattoria"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[#ab9d8b] bg-white px-4 text-sm font-semibold text-[#342a23]"
          >
            Öppna restaurangens webbplats ↗
          </a>
        </section>
      </main>
    );
  }
  const images = (await getDashboardGalleryItems()).filter(
    (item) => item.mediaType === "image",
  );
  const referenceHeroImage =
    !site.published && DONIS_FALLBACK_SITE.media.hero
      ? DONIS_FALLBACK_IMAGES[DONIS_FALLBACK_SITE.media.hero.id]
      : undefined;
  const referenceGalleryImages = !site.published
    ? DONIS_FALLBACK_SITE.media.gallery
        .map((item) => DONIS_FALLBACK_IMAGES[item.id])
        .filter((url): url is string => Boolean(url))
    : [];

  return (
    <RestaurantEditor
      initial={site}
      images={images.map(({ id, publicUrl, altText }) => ({
        id,
        url: publicUrl,
        alt: altText,
      }))}
      referenceDishImages={
        site.published ? {} : DONIS_FALLBACK_DISH_IMAGE_URLS
      }
      referenceHeroImage={referenceHeroImage}
      referenceGalleryImages={referenceGalleryImages}
    />
  );
}
