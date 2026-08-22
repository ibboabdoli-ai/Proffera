import type { Metadata } from "next";

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
      <QuoteRequestForm
        locale="sv"
        initialValues={initialValues}
        alternateLocaleHref="/en/get-quote?resume=1"
        alternateLocaleLabel="EN English"
      />
    </PageShell>
  );
}
