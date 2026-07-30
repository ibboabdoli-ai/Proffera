import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Request a Proffera demo",
  description: "Tell us about your business to request a relevant Proffera demo.",
  englishPath: "/en/join-business/register",
  swedishPath: "/anslut-foretag/registrera",
});

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

const inputClassName = "mt-2 min-h-12 w-full rounded-xl border border-[#cfd8cf] bg-white px-4 py-3 text-base text-[#17201a] outline-none transition placeholder:text-[#7b867e] focus:border-[#17452f] focus:ring-4 focus:ring-[#17452f]/10";

export default async function EnglishRegistrationPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-5xl"><Link className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#17452f] transition hover:bg-[#e7f1eb] focus:outline-none focus:ring-4 focus:ring-[#17452f]/10" href="/en/demo"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to demo</Link>
        <div className="mt-6 grid overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-[#dfe5dd] lg:grid-cols-[0.82fr_1.18fr]"><section className="bg-[#102a1c] p-7 text-white sm:p-10"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Book a demo</p><h1 className="mt-4 text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-4xl">Tell us a little about your business.</h1><p className="mt-5 text-base leading-7 text-white/75">We use this information to prepare a relevant Proffera demo for your customer workflow.</p><ul className="mt-8 space-y-4 text-sm leading-6 text-white/85"><li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />Bookings, leads and customers in one place.</li><li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />A walkthrough based on your services and locations.</li><li className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />No booking or payment is created here.</li></ul></section>
          <section className="p-6 sm:p-10"><h2 className="text-2xl font-bold tracking-tight text-[#17201a]">Send your request</h2><p className="mt-2 text-sm leading-6 text-[#5b665f]">Fields marked <span aria-hidden="true">*</span> are required.</p>{error ? <p className="mt-5 rounded-xl border border-[#e7b8b1] bg-[#fff4f2] px-4 py-3 text-sm font-medium text-[#8a2b20]" role="alert">{error}</p> : null}<form action="/api/foretag" method="post" className="mt-7 grid gap-5"><input name="locale" type="hidden" value="en" /><label className="absolute left-[-10000px]" aria-hidden="true">Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-[#26322a]">Company name *<input autoComplete="organization" className={inputClassName} name="companyName" required /></label><label className="text-sm font-semibold text-[#26322a]">Organisation number *<input className={inputClassName} inputMode="numeric" name="organizationNumber" required /></label><label className="text-sm font-semibold text-[#26322a]">Contact person *<input autoComplete="name" className={inputClassName} name="contactPerson" required /></label><label className="text-sm font-semibold text-[#26322a]">Email *<input autoComplete="email" className={inputClassName} name="email" required type="email" /></label><label className="text-sm font-semibold text-[#26322a]">Phone *<input autoComplete="tel" className={inputClassName} name="phone" required type="tel" /></label><label className="text-sm font-semibold text-[#26322a]">City *<input autoComplete="address-level2" className={inputClassName} name="city" required /></label></div><label className="text-sm font-semibold text-[#26322a]">Where do you work? *<input className={inputClassName} name="serviceAreas" placeholder="For example, Malmö and Lund" required /></label><label className="text-sm font-semibold text-[#26322a]">Which services do you offer? *<input className={inputClassName} name="services" placeholder="For example, electrical installation and service" required /></label><label className="text-sm font-semibold text-[#26322a]">What would you like to improve? *<textarea className={`${inputClassName} min-h-32 resize-y`} name="description" placeholder="Tell us briefly about your customer workflow or what you want to see in the demo." required /></label><label className="flex items-start gap-3 rounded-xl bg-[#fbfbf8] p-4 text-sm leading-6 text-[#344139] ring-1 ring-[#dfe5dd]"><input className="mt-1 h-4 w-4 accent-[#17452f]" name="consentAccepted" required type="checkbox" /><span>I agree that Proffera may contact me about my demo request.</span></label><button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#17452f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123724] focus:outline-none focus:ring-4 focus:ring-[#17452f]/20" type="submit">Send demo request</button><p className="text-center text-xs leading-5 text-[#6b766e]">The form does not send email automatically.</p></form></section>
        </div>
      </div>
    </main>
  );
}
