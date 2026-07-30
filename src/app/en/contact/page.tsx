import { Mail, MapPin, MessageSquare } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Contact Proffera",
  description: "Contact Proffera to book a demo or discuss booking systems, CRM and lead management for your service business.",
  englishPath: "/en/contact",
  swedishPath: "/kontakt",
});

export default function EnglishContactPage() {
  return (
    <div className="overflow-hidden bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Contact</p><h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-[#17201a] sm:text-5xl">Would you like to see how Proffera can work for your business?</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">Book a demo and we will show booking, leads and customer management in one simple flow.</p><div className="mt-8"><ButtonLink href="/en/join-business/register">Book a demo</ButtonLink></div></section>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8"><div className="rounded-2xl bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10"><h2 className="text-2xl font-bold">Contact details</h2><div className="mt-6 space-y-5 text-sm text-white/75"><p className="flex gap-3"><Mail className="h-5 w-5 text-[#a9dbb9]" aria-hidden="true" /> leads@proffera.se</p><p className="flex gap-3"><MapPin className="h-5 w-5 text-[#a9dbb9]" aria-hidden="true" /> Sweden</p><p className="flex gap-3"><MessageSquare className="h-5 w-5 text-[#a9dbb9]" aria-hidden="true" /> Demos and pilot customers</p></div></div><div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd]"><h2 className="text-2xl font-bold text-[#17201a]">Book a demo or email us</h2><p className="mt-2 text-sm leading-6 text-[#5b665f]">Tell us briefly about your business, the services you offer and the workflow you want to improve. We will suggest a demo or pilot setup.</p><div className="mt-6 rounded-xl bg-[#fbfbf8] p-5 text-sm text-[#344139] ring-1 ring-[#dfe5dd]"><p className="font-semibold text-[#17201a]">Helpful information to send:</p><ul className="mt-3 list-disc space-y-2 pl-5"><li>Business name, industry and city</li><li>Whether you want to test booking, leads or customer management</li><li>A phone number or email address for follow-up</li></ul></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/en/join-business/register">Book a demo</ButtonLink><a className="inline-flex min-h-11 w-fit items-center rounded-xl border border-[#17452f] bg-white px-5 py-3 text-sm font-semibold text-[#17452f]" href="mailto:leads@proffera.se?subject=Proffera%20demo">Send email</a></div></div></section>
    </div>
  );
}
