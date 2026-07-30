import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Pricing for booking, lead management and CRM",
  description: "Choose a Proffera plan for digital booking, lead management and customer CRM. Prices are shown in SEK for businesses in Sweden.",
  englishPath: "/en/pricing",
  swedishPath: "/priser",
});

const pricingPlans = [
  { name: "Starter", price: "From SEK 299/month", description: "For small businesses that want to get started with digital enquiries and bookings.", features: ["Booking flow", "Email notifications", "Contact forms", "Basic lead list"] },
  { name: "Professional", price: "From SEK 699/month", description: "For growing businesses that want leads, customers and bookings in one system.", features: ["Everything in Starter", "Customer CRM", "Booking history", "Service catalogue", "Automated booking confirmations"] },
  { name: "Business", price: "Custom quote", description: "For businesses with multiple teams, locations or tailored integration needs.", features: ["Everything in Professional", "Priority support", "Multiple locations", "Tailored integrations"] },
] as const;

export default function EnglishPricingPage() {
  return (
    <div className="overflow-hidden bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Pricing</p><h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-[#17201a] sm:text-5xl">Choose a plan that matches your business’s digital workflow.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">Start with booking and forms. Add customer CRM when you need to bring more customer flows into one place.</p><p className="mt-4 text-sm font-medium text-[#526057]">Prices are shown in SEK and the current offer is for businesses operating in Sweden.</p></section>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-3 lg:px-8">{pricingPlans.map((plan) => <article key={plan.name} className={`rounded-2xl bg-white p-6 shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#17452f]/8 ${plan.name === "Professional" ? "border-[#91c5a2] shadow-lg shadow-[#17452f]/10" : "ring-[#dfe5dd]"}`}><h2 className="text-2xl font-bold text-[#17201a]">{plan.name}</h2><p className="mt-3 text-3xl font-bold text-[#17452f]">{plan.price}</p><p className="mt-3 text-sm leading-6 text-[#5b665f]">{plan.description}</p><ul className="mt-6 space-y-3 text-sm text-[#344139]">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-[#17452f]" aria-hidden="true" />{feature}</li>)}</ul><div className="mt-8"><ButtonLink href={plan.name === "Business" ? "/en/contact" : "/en/join-business/register"} variant={plan.name === "Professional" ? "primary" : "secondary"}>{plan.name === "Business" ? "Talk to us" : `Choose ${plan.name}`}</ButtonLink></div></article>)}</section>
    </div>
  );
}
