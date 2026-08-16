import type { Metadata } from "next";

import { PublicDirectoryProfile } from "@/components/company-directory/public-directory-profile";
import { directoryCategoryLabels } from "@/components/company-directory/public-directory-copy";
import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function absoluteUrl(value: string) {
  return new URL(value, siteConfig.url).toString();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicDirectoryBusiness(slug);
  if (!business) return {};
  const category = directoryCategoryLabels.sv[business.categorySlug] ?? business.primarySniLabel ?? "Tjänster";
  const description = business.activityDescription || `${business.companyName} i ${business.city} – ${category}.`;
  const swedishPath = `/foretag/listad/${encodeURIComponent(business.slug)}`;
  const englishPath = `/en/companies/${encodeURIComponent(business.slug)}`;
  const canonical = `${siteConfig.url}${swedishPath}`;
  const hasActualBusinessMedia = Boolean(business.media?.isActualBusinessMedia && business.media.url);

  return {
    title: `${business.companyName} | Proffera`,
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
  };
}

export default async function ListedBusinessPage({ params }: Props) {
  const { slug } = await params;
  return <PublicDirectoryProfile slug={slug} locale="sv" />;
}
