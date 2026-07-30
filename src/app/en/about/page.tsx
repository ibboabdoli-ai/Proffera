import { ShieldCheck, Sparkles, Target } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "About Proffera",
  description: "Proffera is developing a clearer digital workflow for Swedish service businesses to manage leads, bookings and customers.",
  englishPath: "/en/about",
  swedishPath: "/om",
});

const values = [
  { icon: Target, title: "Built for small businesses", text: "Proffera focuses on everyday needs: leads, bookings, customers and follow-up." },
  { icon: Sparkles, title: "Modules with clear status", text: "Planned features are marked as planned and are not automatically enabled for customer workspaces." },
  { icon: ShieldCheck, title: "A clear Swedish process", text: "The platform is developed step by step with a focus on safety, clarity and local service businesses." },
];

export default function EnglishAboutPage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">About Proffera</p><h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">We are building a simpler way for service businesses to grow digitally.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">Proffera started as a lead and quote workflow and is evolving step by step into a SaaS platform for small businesses in Sweden.</p></section>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-3 lg:px-8">{values.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]"><Icon className="h-8 w-8 text-[#17452f]" aria-hidden="true" /><h2 className="mt-4 text-xl font-semibold text-[#17201a]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#5b665f]">{text}</p></article>)}</section>
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"><div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd]"><h2 className="text-2xl font-bold text-[#17201a]">What comes next</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5b665f]">We are continuing with public pages, dashboard, booking flows, CRM and subscriptions in a controlled way. Planned modules launch only when they are ready to use.</p><div className="mt-6"><ButtonLink href="/en/contact">Talk to us</ButtonLink></div></div></section>
    </div>
  );
}
