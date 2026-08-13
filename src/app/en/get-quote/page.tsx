import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { QuoteRequestForm } from "@/features/quote-request/quote-request-form";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Get quotes",
  description: "Describe your job and get matched with suitable companies through Proffera.",
  englishPath: "/en/get-quote",
  swedishPath: "/fa-offert",
});

export default function EnglishQuotePage() {
  return <PageShell
    eyebrow="Get quotes"
    title="Describe your job step by step."
    description="Add the service, location, job details and your contact information. Proffera uses the information to handle your request and match it with suitable companies."
  >
    <div className="mb-4 flex justify-end">
      <Link href="/fa-offert" className="rounded-full border border-[#dfe5dd] bg-white px-4 py-2 text-sm font-semibold text-[#17452f]">SV Svenska</Link>
    </div>
    <QuoteRequestForm locale="en" />
  </PageShell>;
}
