import type { Metadata } from "next";

import { MarketplaceProfileClaimPrompt } from "@/components/company-directory/marketplace-profile-claim-prompt";
import { PublicDirectoryProfile } from "@/components/company-directory/public-directory-profile";
import { directoryCategoryLabels } from "@/components/company-directory/public-directory-copy";
import { getSeoBusinessProjection } from "@/lib/business-profile-public";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ from?: string | string[] }>;
};

function absoluteUrl(value: string) {
  return new URL(value, siteConfig.url).toString();
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getSeoBusinessProjection(slug);
  if (!business) return {};
  const category = directoryCategoryLabels.sv[business.categorySlug] ?? "Tjänster";
  const description = business.description || `${business.displayName}${business.city ? ` i ${business.city}` : ""} – ${category}.`;
  const swedishPath = `/foretag/listad/${encodeURIComponent(business.directorySlug)}`;
  const englishPath = `/en/companies/${encodeURIComponent(business.directorySlug)}`;
  const canonical = `${siteConfig.url}${swedishPath}`;
  const hasBusinessMedia = Boolean(business.mediaUrl);

  return {
    title: business.displayName,
    description,
    alternates: {
      canonical,
      languages: {
        "sv-SE": swedishPath,
        en: englishPath,
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: business.displayName,
      description,
      url: canonical,
      type: "website",
      ...(hasBusinessMedia ? {
        images: [{
          url: absoluteUrl(business.mediaUrl),
          alt: business.displayName,
        }],
      } : {}),
    },
    twitter: {
      card: hasBusinessMedia ? "summary_large_image" : "summary",
      title: business.displayName,
      description,
      ...(hasBusinessMedia ? {
        images: [{
          url: absoluteUrl(business.mediaUrl),
          alt: business.displayName,
        }],
      } : {}),
    },
  };
}

export default async function ListedBusinessPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const marketplaceEntry = first(query?.from) === "marketplace";
  return (
    <>
      {marketplaceEntry ? <MarketplaceProfileClaimPrompt slug={slug} locale="sv" /> : null}
      <PublicDirectoryProfile slug={slug} locale="sv" />
    </>
  );
}
