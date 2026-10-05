import { redirect } from "next/navigation";

import { DonisTrattoriaLuxuryExperience } from "@/app/demo/donis-trattoria2/demo-interactions";
import {
  getRestaurantAdmin,
  getRestaurantImageUrls,
} from "@/lib/restaurant-site-db";
import { projectPublicRestaurantSite } from "@/lib/restaurant-site-public";
import { publishDraft } from "../actions";

export const dynamic = "force-dynamic";

async function publish(formData: FormData) {
  "use server";
  const revision = Number(formData.get("revision"));
  const locale = formData.get("lang") === "en" ? "en" : "sv";
  const result = await publishDraft(revision);
  if (!result.ok)
    redirect(
      locale === "en"
        ? `/dashboard/restaurang/forhandsgranska?lang=en&error=${encodeURIComponent(result.error)}`
        : `/dashboard/restaurang/forhandsgranska?error=${encodeURIComponent(result.error)}`,
    );
  redirect(
    locale === "en"
      ? "/dashboard/restaurang?lang=en&published=1"
      : "/dashboard/restaurang?published=1",
  );
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; lang?: string }>;
}) {
  const site = await getRestaurantAdmin();
  if (!site) redirect("/dashboard/restaurang");
  const previewSite = projectPublicRestaurantSite(site.draft);
  const images = await getRestaurantImageUrls(previewSite);
  const { error, lang } = await searchParams;
  const locale = lang === "en" ? "en" : "sv";
  return (
    <div className="-mx-4 -mt-4 sm:-mx-6">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-[#572e28] px-5 py-3 text-white">
        <div>
          <strong>
            {locale === "en"
              ? "Preview of saved draft"
              : "Förhandsgranskning av sparat utkast"}
          </strong>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a
            className="rounded-lg border border-white px-4 py-3 text-sm font-bold"
            href={locale === "en" ? "/dashboard/restaurang?lang=en" : "/dashboard/restaurang"}
          >
            {locale === "en" ? "← Edit" : "← Redigera"}
          </a>
          <form action={publish}>
            <input type="hidden" name="revision" value={site.revision} />
            <input type="hidden" name="lang" value={locale} />
            <button className="min-h-11 rounded-lg bg-[#f4e3c4] px-5 font-bold text-[#211d19]">
              {locale === "en" ? "Publish" : "Publicera"}
            </button>
          </form>
        </div>
      </div>
      <DonisTrattoriaLuxuryExperience
        site={previewSite}
        images={images}
        initialLang={locale}
      />
    </div>
  );
}
