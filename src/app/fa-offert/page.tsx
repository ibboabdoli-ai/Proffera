import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { QuoteRequestForm } from "@/features/quote-request/quote-request-form";

export const metadata: Metadata = {
  title: "Få offerter",
  description: "Beskriv ditt uppdrag och bli matchad med lämpliga företag via Proffera.",
  alternates: {
    canonical: "/fa-offert",
    languages: { "sv-SE": "/fa-offert", en: "/en/get-quote" },
  },
};

type QuotePageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    service?: string | string[];
    city?: string | string[];
  }>;
};

function queryValue(value: string | string[] | undefined, maxLength = 120) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim().slice(0, maxLength) : "";
}

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const initialValues = {
    category: queryValue(params?.category),
    serviceType: queryValue(params?.service),
    city: queryValue(params?.city),
  };

  return (
    <PageShell
      eyebrow="Få offerter"
      title="Beskriv ditt uppdrag steg för steg."
      description="Fyll i tjänst, plats, beskrivning och kontaktuppgifter. Proffera använder uppgifterna för att hantera förfrågan och matcha den med lämpliga företag."
    >
      <div className="mb-4 flex justify-end">
        <Link href="/en/get-quote" className="rounded-full border border-[#dfe5dd] bg-white px-4 py-2 text-sm font-semibold text-[#17452f]">EN English</Link>
      </div>
      <QuoteRequestForm locale="sv" initialValues={initialValues} />
    </PageShell>
  );
}
