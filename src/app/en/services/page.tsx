import { ArrowRight, Bot, CalendarCheck, MailCheck, QrCode, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Features for digital booking and customer management",
  description: "Explore Proffera's modules for online booking, lead management, customer CRM, automated email and QR booking.",
  englishPath: "/en/services",
  swedishPath: "/tjanster",
});

const highlights = [
  { icon: CalendarCheck, title: "Online booking", text: "Let customers book a time or send an enquiry directly from your business website." },
  { icon: Bot, title: "AI chat assistant (planned)", text: "Prepared for future customer dialogue and lead capture. It is not part of the active portal yet." },
  { icon: Users, title: "Customer CRM", text: "Keep customer details, history and follow-up in one place." },
  { icon: MailCheck, title: "Automated email", text: "Send confirmations, internal notifications and follow-ups without manual work." },
  { icon: QrCode, title: "QR booking", text: "Make it easy to begin a booking from signs, business cards, vehicles or ads." },
];

const modules = ["Online booking", "AI chat assistant (planned)", "QR booking", "Lead management", "Customer CRM", "Automated confirmations", "Booking reminders", "Digital forms", "Business website", "Business automation (planned)"] as const;

export default function EnglishServicesPage() {
  return (
    <div className="overflow-hidden bg-[#f7f7f4]">
      <section className="border-b border-[#dfe5dd] bg-[radial-gradient(circle_at_85%_0%,rgba(145,197,162,0.28),transparent_35%),linear-gradient(180deg,#fff_0%,#f7f7f4_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Features</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-[#17201a] sm:text-5xl">Digital tools for service businesses that want to grow with clarity.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">Proffera combines booking, lead management and CRM in one system for small businesses in Sweden. AI support and more automation are developed step by step.</p>
        </div>
      </section>

      <section className="bg-white py-20"><div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-5 lg:px-8">{highlights.map(({ icon: Icon, title, text }, index) => <article key={title} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-6 transition hover:-translate-y-1 hover:border-[#b6cfbd] hover:bg-white hover:shadow-lg hover:shadow-[#17452f]/5"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f1eb]"><Icon className="h-5 w-5 text-[#17452f]" aria-hidden="true" /></div><span className="text-sm font-bold text-[#9aa69e]">0{index + 1}</span></div><h2 className="mt-6 text-lg font-semibold text-[#17201a]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#5b665f]">{text}</p></article>)}</div></section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><h2 className="text-3xl font-bold tracking-tight text-[#17201a]">Modules</h2><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modules.map((module) => <div key={module} className="flex items-center justify-between rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#dfe5dd] transition hover:-translate-y-0.5 hover:ring-[#b6cfbd]"><span className="font-medium text-[#17201a]">{module}</span><ArrowRight className="h-4 w-4 text-[#17452f]" aria-hidden="true" /></div>)}</div><div className="mt-10"><ButtonLink href="/en/demo">Book a demo</ButtonLink></div></section>
    </div>
  );
}
