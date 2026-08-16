import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingIndustryDetail } from "@/components/marketing/marketing-industry-detail";
import {
  isMarketingIndustrySlug,
  marketingIndustryPages,
  marketingIndustrySlugs,
} from "@/lib/marketing-industry-pages";
import { siteConfig } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return marketingIndustrySlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isMarketingIndustrySlug(slug)) return {};

  const page = marketingIndustryPages[slug];
  const canonical = `${siteConfig.url}/branscher/${page.slug}`;

  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical },
    openGraph: {
      title: page.title,
      description: page.description,
      url: canonical,
      siteName: siteConfig.name,
      locale: "sv_SE",
      type: "website",
    },
  };
}

export default async function MarketingIndustryPage({ params }: Props) {
  const { slug } = await params;
  if (!isMarketingIndustrySlug(slug)) notFound();

  return <MarketingIndustryDetail slug={slug} />;
}
