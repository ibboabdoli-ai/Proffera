import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CirclePoundSterling,
  Droplets,
  House,
  Mail,
  PanelsTopLeft,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = {
  title: "PrimeView Window Care | Professional Exterior Cleaning",
  description:
    "Professional window and exterior cleaning across West and North London.",
};

const phoneDisplay = "07500 338 585";
const phoneHref = "+447500338585";
const email = "am@primeviewlondon.co.uk";

const services = [
  {
    title: "Window Cleaning",
    description: "Streak-free window cleaning for homes and businesses.",
    icon: PanelsTopLeft,
  },
  {
    title: "Fascia & Soffit Cleaning",
    description: "Remove dirt and grime from fascias, soffits and cladding.",
    icon: House,
  },
  {
    title: "Conservatory Roof Cleaning",
    description: "Bring back the shine to your conservatory roof.",
    icon: Sparkles,
  },
  {
    title: "Gutter Cleaning",
    description: "Clear gutters and downpipes to protect your property.",
    icon: Droplets,
  },
  {
    title: "Driveway & Patio Cleaning",
    description: "High-pressure cleaning for driveways, patios and paths.",
    icon: Wrench,
  },
  {
    title: "Solar Panel Cleaning",
    description: "Improve efficiency with safe solar panel cleaning.",
    icon: PanelsTopLeft,
  },
];

export default function PrimeViewDemoPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#071739]">
      <section id="home" className="relative isolate overflow-hidden bg-[#061b40] text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(2,17,47,.97) 0%, rgba(4,29,68,.89) 38%, rgba(3,25,58,.32) 66%, rgba(1,12,31,.18) 100%), url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=85')",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_15%,rgba(41,105,189,.28),transparent_34%)]" />

        <header className="relative z-20 mx-auto flex max-w-[1450px] items-center justify-between px-6 py-5 lg:px-10">
          <a href="#home" className="flex items-center gap-3">
            <div className="grid h-24 w-32 place-items-center rounded-[42%_42%_48%_48%] border-4 border-slate-200 bg-gradient-to-b from-[#102d68] to-[#06163a] shadow-[0_0_0_3px_rgba(255,255,255,.2),0_12px_30px_rgba(0,0,0,.4)]">
              <div className="text-center">
                <div className="text-2xl font-black tracking-tight text-white">PrimeView</div>
                <div className="mt-1 border-t border-white/60 pt-1 text-[10px] font-bold tracking-[.22em] text-slate-100">WINDOW CARE</div>
              </div>
            </div>
          </a>

          <nav className="hidden items-center gap-10 text-sm font-bold lg:flex">
            <a href="#home" className="hover:text-[#d8ad42]">Home</a>
            <a href="#services" className="flex items-center gap-2 hover:text-[#d8ad42]">Services <ChevronDown className="size-4" /></a>
            <a href="#about" className="hover:text-[#d8ad42]">About Us</a>
            <a href="#services" className="hover:text-[#d8ad42]">Gallery</a>
            <a href="#contact" className="hover:text-[#d8ad42]">Contact</a>
          </nav>

          <a href="#contact" className="hidden items-center gap-2 rounded-lg bg-[#d8ad42] px-6 py-4 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 md:inline-flex">
            Get a Free Quote <ArrowRight className="size-4" />
          </a>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[570px] max-w-[1450px] items-center px-6 pb-24 pt-8 lg:px-10">
          <div className="max-w-[620px]">
            <h1 className="text-5xl font-black leading-[.98] tracking-[-.04em] sm:text-6xl lg:text-7xl">
              Crystal Clear
              <span className="mt-2 block text-[#d8ad42]">Results</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-7 text-slate-100">
              Professional window cleaning and exterior care you can rely on.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {[
                { icon: CirclePoundSterling, title: "Affordable", text: "Great results, fair prices" },
                { icon: ShieldCheck, title: "Reliable", text: "On time, every time, every job" },
                { icon: Star, title: "Spotless Finish", text: "We leave every surface looking its best" },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-3">
                  <Icon className="mt-0.5 size-10 shrink-0 text-[#d8ad42]" strokeWidth={1.8} />
                  <div>
                    <h2 className="font-extrabold">{title}</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-200">{text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a href="#contact" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d8ad42] px-6 py-4 font-extrabold shadow-lg transition hover:-translate-y-0.5">
                Get a Free Quote <ArrowRight className="size-4" />
              </a>
              <a href={`tel:${phoneHref}`} className="inline-flex items-center gap-3 rounded-lg border border-white/70 bg-[#071b40]/70 px-5 py-3 font-bold backdrop-blur">
                <Phone className="size-5" />
                <span><span className="block text-xs">Call Us</span>{phoneDisplay}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-10 -mt-8">
        <section id="services" className="mx-auto max-w-[1450px] rounded-t-[22px] bg-[#f8f9fc] px-6 py-10 shadow-[0_-12px_34px_rgba(2,17,47,.08)] lg:px-10">
          <div className="text-center">
            <p className="text-xs font-black tracking-[.08em] text-[#123d99]">OUR SERVICES</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Professional Exterior Cleaning</h2>
            <div className="mx-auto mt-2 h-0.5 w-10 bg-[#d8ad42]" />
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              We offer a full range of exterior cleaning services to keep your home or business looking its best all year round.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {services.map(({ title, description, icon: Icon }) => (
              <article key={title} className="flex min-h-[220px] flex-col rounded-xl border border-slate-200 bg-white p-5 text-center shadow-[0_7px_22px_rgba(15,34,74,.08)] transition hover:-translate-y-1 hover:shadow-xl">
                <div className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-[#104bb6] to-[#061c65] text-white">
                  <Icon className="size-8" strokeWidth={1.6} />
                </div>
                <h3 className="mt-4 text-base font-black leading-5">{title}</h3>
                <p className="mt-3 text-sm leading-5 text-slate-600">{description}</p>
                <a href="#contact" className="mt-auto pt-4 text-left text-sm font-extrabold text-[#103c9b]">Learn More <ArrowRight className="ml-1 inline size-4" /></a>
              </article>
            ))}
          </div>

          <div id="about" className="mt-4 grid overflow-hidden rounded-xl bg-gradient-to-r from-[#0a2557] to-[#061a43] px-7 py-5 text-white lg:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Fully Insured & Reliable", text: "Your property is in safe hands with our fully insured and experienced team." },
              { icon: CalendarDays, title: "Flexible Appointments", text: "We work around your schedule, including weekends and evenings." },
              { icon: Phone, title: "Call Us Today", text: `${phoneDisplay} · Get your free, no-obligation quote.` },
            ].map(({ icon: Icon, title, text }, index) => (
              <div key={title} className={`flex gap-5 py-3 ${index ? "lg:border-l lg:border-white/25 lg:pl-10" : ""}`}>
                <Icon className="size-12 shrink-0 text-[#d8ad42]" strokeWidth={1.7} />
                <div>
                  <h3 className="font-extrabold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-200">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="bg-white px-6 py-16 lg:px-10">
          <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-slate-200 shadow-xl lg:grid-cols-[.8fr_1.2fr]">
            <div className="bg-[#0a2557] p-8 text-white md:p-10">
              <p className="text-sm font-black uppercase tracking-[.2em] text-[#d8ad42]">Free quote</p>
              <h2 className="mt-3 text-4xl font-black">Tell us what needs cleaning.</h2>
              <p className="mt-4 leading-7 text-slate-200">Send your details and PrimeView Window Care will get back to you with a clear, no-obligation quote.</p>
              <div className="mt-8 space-y-4 text-sm font-bold">
                <a href={`tel:${phoneHref}`} className="flex items-center gap-3"><Phone className="size-5 text-[#d8ad42]" /> {phoneDisplay}</a>
                <a href={`mailto:${email}`} className="flex items-center gap-3"><Mail className="size-5 text-[#d8ad42]" /> {email}</a>
                <p>Serving West & North London</p>
              </div>
            </div>
            <form action={`mailto:${email}`} method="post" encType="text/plain" className="grid gap-5 p-8 sm:grid-cols-2 md:p-10">
              <label className="grid gap-2 text-sm font-bold">Name<input name="name" required className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#104bb6]" /></label>
              <label className="grid gap-2 text-sm font-bold">Phone<input name="phone" required className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#104bb6]" /></label>
              <label className="grid gap-2 text-sm font-bold sm:col-span-2">Postcode<input name="postcode" className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#104bb6]" /></label>
              <label className="grid gap-2 text-sm font-bold sm:col-span-2">What do you need cleaned?<textarea name="message" required rows={5} className="resize-none rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#104bb6]" /></label>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d8ad42] px-6 py-4 font-extrabold text-white sm:col-span-2">Request my free quote <ArrowRight className="size-4" /></button>
            </form>
          </div>
        </section>
      </main>

      <footer className="bg-[#04132f] px-6 py-9 text-center text-sm text-slate-300">
        <p className="font-extrabold text-white">PrimeView Window Care</p>
        <p className="mt-2">Professional exterior cleaning across West & North London.</p>
      </footer>
    </div>
  );
}
