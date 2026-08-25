import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import { getDirectorySeoLanding } from "@/lib/company-directory-landing-seo";
import { searchPublishedCompanyDirectory } from "@/lib/company-directory-public-search";

export const dynamic = "force-dynamic";

const getCachedDirectorySeoLanding = cache(getDirectorySeoLanding);

type Props = {
  params: Promise<{ service: string; location: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service, location } = await params;
  const landing = await getCachedDirectorySeoLanding(service, location);
  if (!landing) return { robots: { index: false, follow: true } };

  const title = `${landing.serviceLabel} i ${landing.location}`;
  const description = `Hitta publicerade företag för ${landing.serviceLabel.toLocaleLowerCase("sv-SE")} i ${landing.location}. Jämför företag och gå vidare till bokning, offert eller företagsprofil där det är tillgängligt.`;
  const canonical = `/hitta/${encodeURIComponent(landing.serviceSlug)}/${encodeURIComponent(landing.locationSlug)}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title: `${title} | Proffera`, description, type: "website", url: canonical },
  };
}

export default async function DirectoryServiceLocationPage({ params }: Props) {
  const { service, location } = await params;
  const landing = await getCachedDirectorySeoLanding(service, location);
  if (!landing) notFound();

  const search = await searchPublishedCompanyDirectory({
    service: landing.serviceSlug,
    location: landing.location,
    limit: 30,
  });
  if (search.results.length === 0) notFound();

  const searchHref = `/foretag/listad?service=${encodeURIComponent(landing.serviceSlug)}&location=${encodeURIComponent(landing.location)}`;

  return (
    <main className="min-h-screen bg-canvas text-ink" lang="sv">
      <section className="border-b border-line bg-surface-subtle">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">Hitta företag</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{landing.serviceLabel} i {landing.location}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Hitta publicerade företag för {landing.serviceLabel.toLocaleLowerCase("sv-SE")} i {landing.location}. Endast publicerade företagsprofiler visas.
          </p>
          <Link href={searchHref} className="mt-5 inline-flex min-h-10 items-center rounded-control border border-brand/25 bg-surface px-4 text-sm font-black text-brand transition hover:bg-brand-soft">
            Öppna sökningen
          </Link>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <PublicDirectoryResults locale="sv" search={search} paginationBaseHref={searchHref} />
      </div>
    </main>
  );
}
