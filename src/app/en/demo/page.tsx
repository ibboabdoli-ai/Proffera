import { Bot, CalendarDays, LayoutDashboard, QrCode } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Book a demo for your service business",
  description: "Book a Proffera demo and see how booking flows, leads and customer management can work for your service business.",
  englishPath: "/en/demo",
  swedishPath: "/demo",
});

const demoBlocks = [
  { icon: CalendarDays, title: "Interactive booking flow", text: "The customer chooses a service, describes their needs and sends a clear enquiry." },
  { icon: LayoutDashboard, title: "Portal overview", text: "The business sees leads, status, delivery logs and follow-ups in one workflow." },
  { icon: Bot, title: "AI support (planned)", text: "AI support is a separate module and is not part of the active base installation." },
  { icon: QrCode, title: "QR booking", text: "QR codes can lead directly to a booking or quote request." },
];

export default function EnglishDemoPage() {
  return (
    <div className="overflow-hidden bg-[#f7f7f4]">
      <section className="relative border-b border-[#dfe5dd] bg-[#102a1c] text-white"><div className="absolute -right-20 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#3e9b68]/25 blur-3xl" /><div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Demo</p><h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-5xl">See how Proffera can work from the first click to follow-up.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-white/75">The demo shows the customer flow, portal overview and QR booking. Planned modules are clearly marked.</p></div></section>
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">{demoBlocks.map(({ icon: Icon, title, text }, index) => <article key={title} className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd] transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#17452f]/8"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f1eb]"><Icon className="h-5 w-5 text-[#17452f]" aria-hidden="true" /></div><span className="text-sm font-bold text-[#9aa69e]">0{index + 1}</span></div><h2 className="mt-6 text-xl font-semibold tracking-tight text-[#17201a]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#5b665f]">{text}</p></article>)}</section>
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"><div className="rounded-[1.75rem] border border-[#cfe0d3] bg-[#e7f1eb] p-8 md:p-11"><h2 className="text-3xl font-bold tracking-tight text-[#17201a]">Want to test the workflow with your business?</h2><p className="mt-3 max-w-2xl text-[#526057]">Send an enquiry and we can review how Proffera can be adapted for your services, locations and customer flows.</p><div className="mt-6"><ButtonLink href="/en/join-business/register" variant="secondary">Book a demo</ButtonLink></div></div></section>
    </div>
  );
}
