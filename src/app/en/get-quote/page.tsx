import { PageShell } from "@/components/layout/page-shell";
import { QuoteRequestForm } from "@/features/quote-request/quote-request-form";
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
  }>;
};

function queryValue(value: string | string[] | undefined, maxLength = 120) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim().slice(0, maxLength) : "";
}

export default async function EnglishQuotePage({ searchParams }: QuotePageProps) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const initialValues = {
    category: queryValue(params?.category),
    serviceType: queryValue(params?.service),
    city: queryValue(params?.city),
  };

  return <PageShell
    eyebrow="Get quotes"
    title="Describe your job step by step."
    description="Add the service, location, job details and your contact information. Proffera uses the information to handle your request and match it with suitable companies."
  >
    <QuoteRequestForm
      locale="en"
      initialValues={initialValues}
      alternateLocaleHref="/fa-offert?resume=1"
      alternateLocaleLabel="SV Svenska"
    />
  </PageShell>;
}
