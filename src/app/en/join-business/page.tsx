import { PageShell } from "@/components/layout/page-shell";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Join Proffera as a business",
  description: "Information for businesses that want to receive relevant enquiries through Proffera.",
  englishPath: "/en/join-business",
  swedishPath: "/anslut-foretag",
});

const benefits = ["Receive relevant enquiries in your service areas", "Build a clear business profile", "Respond to leads and follow their status in the dashboard"] as const;

export default function EnglishJoinBusinessPage() {
  return (
    <PageShell eyebrow="For businesses" title="Receive more relevant enquiries as the business workflow opens." description="Proffera gives approved businesses a structured way to view matched opportunities, respond to leads and build trust through their profile and reviews." ctaLabel="Book a demo" ctaHref="/en/join-business/register">
      <div className="grid gap-4 md:grid-cols-3">{benefits.map((benefit) => <article key={benefit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]"><h2 className="text-lg font-semibold">{benefit}</h2></article>)}</div>
    </PageShell>
  );
}
