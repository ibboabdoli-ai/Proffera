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

function absoluteUrl(value: string) {
  return new URL(value, siteConfig.url).toString();
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicDirectoryBusinessForRequest(slug);
  if (!business) return {};
  const category = directoryCategoryLabels.sv[business.categorySlug] ?? business.primarySniLabel ?? "Tjänster";
  const description = business.activityDescription || `${business.companyName} i ${business.city} – ${category}.`;
  const swedishPath = `/foretag/listad/${encodeURIComponent(business.slug)}`;
  const englishPath = `/en/companies/${encodeURIComponent(business.slug)}`;
  const canonical = `${siteConfig.url}${swedishPath}`;
  const hasActualBusinessMedia = Boolean(business.media?.isActualBusinessMedia && business.media.url);

  return {
    title: business.companyName,
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
      title: business.companyName,
      description,
      url: canonical,
      type: "website",
      ...(hasActualBusinessMedia ? {
        images: [{
          url: absoluteUrl(business.media!.url),
          alt: business.companyName,
        }],
      } : {}),
    },
    twitter: {
      card: hasActualBusinessMedia ? "summary_large_image" : "summary",
      title: business.companyName,
      description,
      ...(hasActualBusinessMedia ? {
        images: [{
          url: absoluteUrl(business.media!.url),
          alt: business.companyName,
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
