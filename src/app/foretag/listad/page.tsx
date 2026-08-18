import type { Metadata } from "next";

import { PublicDirectorySearchPage } from "@/components/company-directory/public-directory-search-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hitta företag | Proffera",
  description: "Sök publicerade företag på Proffera efter tjänst och ort.",
  alternates: {
    canonical: "/foretag/listad",
    languages: { "sv-SE": "/foretag/listad", en: "/en/companies" },
  },
  robots: { index: false, follow: true },
};

type PageProps = {
  searchParams?: Promise<{
    service?: string | string[];
    location?: string | string[];
    latitude?: string | string[];
    longitude?: string | string[];
    radius?: string | string[];
    page?: string | string[];
  }>;
};

export default function ListedDirectorySearchPage({ searchParams }: PageProps) {
  return <PublicDirectorySearchPage locale="sv" searchParams={searchParams} />;
}
