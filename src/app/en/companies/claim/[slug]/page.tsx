import type { Metadata } from "next";

import ClaimCompanyPage from "@/app/foretag/claim/[slug]/page";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ status?: string | string[] }>;
};

export default function EnglishClaimCompanyPage({ params, searchParams }: Props) {
  const localizedSearchParams = (async () => {
    const query = await (searchParams ?? Promise.resolve(undefined));
    return { ...query, lang: "en" as const };
  })();

  return ClaimCompanyPage({ params, searchParams: localizedSearchParams });
}
