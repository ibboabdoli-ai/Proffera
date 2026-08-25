import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { directoryQuotePrefill } from "@/features/quote-request/directory-prefill";
import { QuoteRequestForm } from "@/features/quote-request/quote-request-form";
import { getQuoteTargetCompany } from "@/features/quote-request/target-company";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Get quotes",
  description: "Describe your job and get matched with suitable companies through Proffera.",
  englishPath: "/en/get-quote",
  swedishPath: "/fa-offert",
});

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

export default async function EnglishQuotePage({ searchParams }: QuotePageProps) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const requestedCompany = queryValue(params?.company, 180);
  const targetCompany = requestedCompany ? await getQuoteTargetCompany(requestedCompany) : null;

  if (requestedCompany && !targetCompany) {
    return <PageShell
      eyebrow="Get a quote"
      title="The selected company cannot receive this request path right now."
      description="We do not silently switch to other companies after you choose a specific company. You can instead start a new request and let Proffera find suitable companies."
    >
      <Link href="/en/get-quote" className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-strong">
        Let Proffera find companies
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

  return <PageShell
    eyebrow={targetCompany ? "Quote to selected company" : "Get quotes"}
    title={targetCompany ? `Send your request to ${targetCompany.companyName}.` : "Describe your job step by step."}
    description={targetCompany
      ? "Your company choice is locked to this request. Proffera will not automatically send it to other companies."
      : "Add the service, location, job details and your contact information. Proffera uses the information to handle your request and match it with suitable companies."}
  >
    <QuoteRequestForm
      locale="en"
      initialValues={initialValues}
      targetCompany={targetCompany ? { slug: targetCompany.slug, companyName: targetCompany.companyName } : undefined}
      alternateLocaleHref={`/fa-offert?${alternateParams.toString()}`}
      alternateLocaleLabel="SV Svenska"
    />
  </PageShell>;
}
