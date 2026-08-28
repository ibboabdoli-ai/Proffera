import type { Metadata } from "next";

import { PublicDirectorySearchPage } from "@/components/company-directory/public-directory-search-page";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const dynamic = "force-dynamic";

const baseMetadata = createEnglishMetadata({
  title: "Find companies",
  description: "Search published companies on Proffera by service and location.",
  englishPath: "/en/companies",
  swedishPath: "/foretag/listad",
});

export const metadata: Metadata = { ...baseMetadata, robots: { index: false, follow: true } };

type PageProps = {
  searchParams?: Promise<{
    service?: string | string[];
    location?: string | string[];
    nearby?: string | string[];
    radius?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
};

export default function EnglishDirectorySearchPage({ searchParams }: PageProps) {
  return <PublicDirectorySearchPage locale="en" searchParams={searchParams} />;
}
