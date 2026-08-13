import type { Metadata } from "next";

import { PublicDirectoryProfile } from "@/components/company-directory/public-directory-profile";
import { directoryCategoryLabels } from "@/components/company-directory/public-directory-copy";
import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicDirectoryBusiness(slug);
  if (!business) return {};
  const category = directoryCategoryLabels.en[business.categorySlug] ?? "Service business";
  const enPath = `/en/companies/${encodeURIComponent(business.slug)}`;
  const svPath = `/foretag/listad/${encodeURIComponent(business.slug)}`;
  const description = `${business.companyName}${business.city ? ` in ${business.city}` : ""} – ${category}. Official Swedish company data on Proffera.`;
  return {
    title: `${business.companyName} | Proffera`,
    description,
    alternates: { canonical: enPath, languages: { "sv-SE": svPath, en: enPath } },
    robots: { index: true, follow: true },
    openGraph: { title: business.companyName, description, url: enPath, type: "website" },
  };
}

export default async function EnglishListedBusinessPage({ params }: Props) {
  const { slug } = await params;
  return <PublicDirectoryProfile slug={slug} locale="en" />;
}
