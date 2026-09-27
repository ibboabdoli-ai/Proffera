import { redirect } from "next/navigation";

import { DonisTrattoriaExperience } from "@/app/demo/donis-trattoria/demo-interactions";
import {
  getRestaurantAdmin,
  getRestaurantImageUrls,
} from "@/lib/restaurant-site-db";
import { publishDraft } from "../actions";

export const dynamic = "force-dynamic";

async function publish(formData: FormData) {
  "use server";
  const revision = Number(formData.get("revision"));
  const result = await publishDraft(revision);
  if (!result.ok)
    redirect(
      `/dashboard/restaurang/forhandsgranska?error=${encodeURIComponent(result.error)}`,
    );
  redirect("/dashboard/restaurang?published=1");
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const site = await getRestaurantAdmin();
  if (!site) redirect("/dashboard/restaurang");
  const images = await getRestaurantImageUrls(site.draft);
  const { error } = await searchParams;
  return (
    <div className="-mx-4 -mt-4 sm:-mx-6">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-[#572e28] px-5 py-3 text-white">
        <div>
          <strong>Förhandsgranskning av sparat utkast</strong>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a
            className="rounded-lg border border-white px-4 py-3 text-sm font-bold"
            href="/dashboard/restaurang"
          >
            ← Redigera
          </a>
          <form action={publish}>
            <input type="hidden" name="revision" value={site.revision} />
            <button className="min-h-11 rounded-lg bg-[#f4e3c4] px-5 font-bold text-[#211d19]">
              Publicera
            </button>
          </form>
        </div>
      </div>
      <DonisTrattoriaExperience site={site.draft} images={images} />
    </div>
  );
}
