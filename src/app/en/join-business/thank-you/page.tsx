import Link from "next/link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Thank you for your request",
  description: "Confirmation after sending a business registration request to Proffera.",
  englishPath: "/en/join-business/thank-you",
  swedishPath: "/anslut-foretag/tack",
});

type PageProps = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function EnglishThanksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const reference = params.ref ?? "";

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6 lg:px-8"><section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd]"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#17452f]">Business</p><h1 className="mt-4 text-4xl font-bold text-[#17201a]">Thank you! Your request has been received.</h1><p className="mt-4 text-[#5b665f]">We have received your information and will contact you about the next step for a demo or installation.</p>{reference ? <p className="mt-6 rounded-2xl bg-[#eef5ef] p-4 font-semibold text-[#17452f]">Reference number: {reference}</p> : null}<div className="mt-8 flex flex-wrap gap-3"><Link className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white" href="/en">Back to home</Link><Link className="rounded-full border border-[#17452f] px-5 py-3 text-sm font-semibold text-[#17452f]" href="/en/join-business">Send another request</Link></div></section></main>
  );
}
