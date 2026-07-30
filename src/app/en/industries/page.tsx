import { ButtonLink } from "@/components/ui/button-link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Built for booking-led service industries",
  description: "Proffera is built for service businesses in Sweden that need bookings, lead management, customer records and better follow-up.",
  englishPath: "/en/industries",
  swedishPath: "/branscher",
});

const industries = [
  { name: "Cleaning and facilities", description: "For home cleaning, office cleaning, move-out cleaning, window cleaning and local facility services.", services: ["Home and recurring cleaning", "Move-out and deep cleaning", "Office and commercial cleaning", "Window and property services"] },
  { name: "Home and technical services", description: "For businesses that coordinate visits, customer requests and follow-up across local service areas.", services: ["Electrical and installation work", "Maintenance and repairs", "Property and seasonal work", "On-site service visits"] },
  { name: "Local professional services", description: "For appointment-led businesses that need a clearer path from enquiry to confirmed customer visit.", services: ["Consultations", "Recurring appointments", "Customer follow-up", "Service packages"] },
  { name: "Growing service teams", description: "For businesses adding more staff, locations or booking channels while keeping the customer workflow in one place.", services: ["Multiple service areas", "Team coordination", "QR entry points", "Customer history"] },
] as const;

export default function EnglishIndustriesPage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Industries</p><h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">Proffera for booking-led service businesses across industries.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">Proffera starts with cleaning and facilities, but is designed for more service industries that need booking, customer management and clear follow-up.</p><div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-[#314139]"><span className="rounded-full bg-white px-4 py-2 ring-1 ring-[#dfe5dd]">4 focus areas</span><span className="rounded-full bg-white px-4 py-2 ring-1 ring-[#dfe5dd]">Service business workflow</span><span className="rounded-full bg-white px-4 py-2 ring-1 ring-[#dfe5dd]">SaaS + booking + CRM</span></div></section>

      <section className="bg-white py-14"><div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">{industries.map((industry) => <article key={industry.name} className="rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-6 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#17452f]">Industry</p><h2 className="mt-2 text-2xl font-bold text-[#17201a]">{industry.name}</h2></div><span className="w-fit rounded-full bg-[#edf4ee] px-3 py-1 text-sm font-medium text-[#17452f]">{industry.services.length} examples</span></div><p className="mt-4 text-sm leading-6 text-[#5b665f]">{industry.description}</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{industry.services.map((service) => <div key={service} className="rounded-2xl bg-white p-4 ring-1 ring-[#dfe5dd]"><h3 className="font-semibold text-[#17201a]">{service}</h3></div>)}</div></article>)}</div></section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"><div className="rounded-3xl bg-[#17201a] p-8 text-white lg:flex lg:items-center lg:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wide text-[#cfe8d5]">Next step</p><h2 className="mt-3 max-w-2xl text-3xl font-bold">Want to see how Proffera can work for your industry?</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-[#d9e6dc]">Book a demo and we can show how booking, lead management and customer records can be adapted for your service business.</p></div><div className="mt-8 lg:mt-0"><ButtonLink href="/en/demo" variant="secondary">Book a demo</ButtonLink></div></div></section>
    </div>
  );
}
