import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { directoryQuotePrefill } from "@/features/quote-request/directory-prefill";
import { QuoteRequestForm } from "@/features/quote-request/quote-request-form";
import { getQuoteTargetCompany } from "@/features/quote-request/target-company";

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
    company?: string | string[];
  }>;
};

function queryValue(value: string | string[] | undefined, maxLength = 120) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim().slice(0, maxLength) : "";
}

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const requestedCompany = queryValue(params?.company, 180);
  const targetCompany = requestedCompany ? await getQuoteTargetCompany(requestedCompany) : null;

  if (requestedCompany && !targetCompany) {
    return <PageShell
      eyebrow="Få offert"
      title="Det valda företaget kan inte ta emot den här vägen just nu."
      description="Vi byter inte automatiskt till andra företag när du har valt ett specifikt företag. Du kan i stället starta en ny förfrågan där Proffera hittar lämpliga företag."
    >
      <Link href="/fa-offert" className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-strong">
        Låt Proffera hitta företag
      </Link>
    </PageShell>;
  }

  const targetPrefill = targetCompany ? directoryQuotePrefill({ categorySlug: targetCompany.categorySlug }) : {};
  const initialValues = {
    category: queryValue(params?.category) || targetPrefill.category || "",
    serviceType: queryValue(params?.service),
    city: queryValue(params?.city),
  };
  const alternateParams = new URLSearchParams({ resume: "1" });
  if (targetCompany) alternateParams.set("company", targetCompany.slug);

  return (
    <PageShell
      eyebrow={targetCompany ? "Offert till valt företag" : "Få offerter"}
      title={targetCompany ? `Skicka förfrågan till ${targetCompany.companyName}.` : "Beskriv ditt uppdrag steg för steg."}
      description={targetCompany
        ? "Ditt företagsval är låst till den här förfrågan. Proffera skickar den inte automatiskt till andra företag."
        : "Fyll i tjänst, plats, beskrivning och kontaktuppgifter. Proffera använder uppgifterna för att hantera förfrågan och matcha den med lämpliga företag."}
    >
      <QuoteRequestForm
        locale="sv"
        initialValues={initialValues}
        targetCompany={targetCompany ? { slug: targetCompany.slug, companyName: targetCompany.companyName } : undefined}
        alternateLocaleHref={`/en/get-quote?${alternateParams.toString()}`}
        alternateLocaleLabel="EN English"
      />
    </PageShell>
  );
}
