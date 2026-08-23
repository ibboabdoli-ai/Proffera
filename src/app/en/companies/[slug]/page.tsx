import type { Metadata } from "next";

import { MarketplaceProfileClaimPrompt } from "@/components/company-directory/marketplace-profile-claim-prompt";
import { PublicDirectoryProfile } from "@/components/company-directory/public-directory-profile";
import { directoryCategoryLabels } from "@/components/company-directory/public-directory-copy";
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ from?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicDirectoryBusinessForRequest(slug);
  if (!business) return {};
  const category = directoryCategoryLabels.en[business.categorySlug] ?? "Service business";
  const enPath = `/en/companies/${encodeURIComponent(business.slug)}`;
  const svPath = `/foretag/listad/${encodeURIComponent(business.slug)}`;
  const canonical = `${siteConfig.url}${enPath}`;
  const hasActualBusinessMedia = Boolean(business.media?.isActualBusinessMedia && business.media.url);
  const description = `${business.companyName}${business.city ? ` in ${business.city}` : ""} – ${category}. Official Swedish company data on Proffera.`;
  return {
    title: business.companyName,
    description,
    alternates: { canonical, languages: { "sv-SE": svPath, en: enPath } },
    robots: { index: true, follow: true },
    openGraph: {
      title: business.companyName,
      description,
      url: canonical,
      type: "website",
      ...(hasActualBusinessMedia ? {
        images: [{ url: new URL(business.media!.url, siteConfig.url).toString(), alt: business.companyName }],
      } : {}),
    },
    twitter: {
      card: hasActualBusinessMedia ? "summary_large_image" : "summary",
      title: business.companyName,
      description,
      ...(hasActualBusinessMedia ? {
        images: [{ url: new URL(business.media!.url, siteConfig.url).toString(), alt: business.companyName }],
      } : {}),
    },
  };
}

export default async function EnglishListedBusinessPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const marketplaceEntry = first(query?.from) === "marketplace";
  return (
    <>
      {marketplaceEntry ? <MarketplaceProfileClaimPrompt slug={slug} locale="en" /> : null}
      <PublicDirectoryProfile slug={slug} locale="en" />
    </>
  );
}
