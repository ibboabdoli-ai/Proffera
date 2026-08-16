import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingServiceDetail } from "@/components/marketing/marketing-service-detail";
import {
  isMarketingServiceSlug,
  marketingServicePages,
  marketingServiceSlugs,
} from "@/lib/marketing-service-pages";
import { siteConfig } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return marketingServiceSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isMarketingServiceSlug(slug)) return {};

  const page = marketingServicePages[slug];
  const canonical = `${siteConfig.url}/tjanster/${page.slug}`;

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

export default async function MarketingServicePage({ params }: Props) {
  const { slug } = await params;
  if (!isMarketingServiceSlug(slug)) notFound();

  return <MarketingServiceDetail slug={slug} />;
}
