import type { Metadata } from "next";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Droplets,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Prime View Window Care – Demo",
  description: "Professional window cleaning across West and North London.",
  robots: { index: false, follow: false },
};

const services = [
  {
    title: "Window Cleaning",
    text: "Reliable streak-free cleaning for homes, flats and commercial properties.",
    icon: Sparkles,
  },
  {
    title: "Frames & Sills",
    text: "Detailed cleaning that leaves the complete window area looking refreshed.",
    icon: ShieldCheck,
  },
  {
    title: "High Reach",
    text: "Safe water-fed pole cleaning for upper floors and difficult access areas.",
    icon: Building2,
  },
  {
    title: "Pressure Washing",
    text: "Powerful cleaning for patios, paving, paths and exterior surfaces.",
    icon: Droplets,
  },
];

export default function PrimeViewDemoPage() {
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3 text-white">
            <span className="grid size-11 place-items-center rounded-2xl border border-white/20 bg-white/10 text-lg font-black backdrop-blur">PV</span>
            <span>
              <strong className="block text-base tracking-wide">PRIME VIEW</strong>
              <span className="block text-xs tracking-[0.22em] text-blue-100">WINDOW CARE</span>
            </span>
          </a>
          <a
            href="tel:+447500338585"
            className="hidden rounded-full bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:-translate-y-0.5 sm:inline-flex"
          >
            Call 07500 338 585
          </a>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden bg-[#091a3a]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(31,111,235,0.55),transparent_34%),linear-gradient(130deg,#071329_0%,#102c61_58%,#0a1731_100%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-14 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:pt-28">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-50 backdrop-blur">
                <CheckCircle2 className="size-4 text-amber-300" /> Serving West & North London
              </div>
              <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                Crystal-clear windows. <span className="text-amber-300">Every time.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-blue-100 sm:text-xl">
                Professional window cleaning for residential and commercial properties, delivered with clarity, care and dependable service.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#quote" className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-7 py-4 font-extrabold text-slate-950 shadow-xl transition hover:-translate-y-0.5">
                  Get a free quote <ArrowRight className="size-5" />
                </a>
                <a href="https://wa.me/447500338585" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 py-4 font-bold text-white backdrop-blur transition hover:bg-white/15">
                  <MessageCircle className="size-5" /> WhatsApp us
                </a>
              </div>
              <div className="mt-10 grid max-w-2xl gap-3 text-sm text-blue-50 sm:grid-cols-3">
                {["Fully insured", "Flexible appointments", "4-week service available"].map((item) => (
                  <div key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-amber-300" /> {item}</div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-5 rounded-[2.5rem] bg-blue-400/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur">
                <div className="aspect-[4/4.5] rounded-[1.4rem] bg-[linear-gradient(155deg,rgba(255,255,255,.1),rgba(255,255,255,.02)),radial-gradient(circle_at_50%_35%,#59a8ff_0%,#174b94_37%,#08162f_74%)] p-6">
                  <div className="flex h-full flex-col justify-between rounded-[1.25rem] border border-white/15 bg-[#07152d]/70 p-7 text-white shadow-inner backdrop-blur-sm">
                    <div>
                      <div className="text-sm font-bold tracking-[.24em] text-amber-300">PRIME VIEW</div>
                      <div className="mt-3 text-4xl font-black leading-tight">A clearer view starts here.</div>
                    </div>
                    <div className="space-y-3 text-blue-100">
                      <p>Window Cleaning · Frames & Sills · High Reach</p>
                      <p>Pressure Washing · Patios · Block Paving</p>
                      <div className="pt-4 text-2xl font-black text-white">ARASH & MASS</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-extrabold uppercase tracking-[.22em] text-blue-700">Our services</span>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Everything your exterior needs to shine</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">Straightforward, reliable cleaning for homes, landlords and businesses across London.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {services.map(({ title, text, icon: Icon }) => (
              <article key={title} className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="size-6" /></div>
                <h3 className="mt-6 text-xl font-extrabold">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#0d234b] text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <span className="text-sm font-extrabold uppercase tracking-[.22em] text-amber-300">Why Prime View?</span>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Professional care, without the hassle.</h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-blue-100">We keep communication simple, arrive when agreed and leave your property looking noticeably brighter.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {["Residential & commercial", "Conservatories", "Regular 4-week visits", "Free, no-obligation quotes"].map((item) => (
                <div key={item} className="flex min-h-28 items-start gap-3 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-300" />
                  <span className="font-bold leading-6">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="quote" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200 lg:grid lg:grid-cols-[.8fr_1.2fr]">
            <div className="bg-[#f0b936] p-8 sm:p-10 lg:p-12">
              <span className="text-sm font-extrabold uppercase tracking-[.2em] text-slate-800">Free quote</span>
              <h2 className="mt-4 text-4xl font-black tracking-tight">Tell us what needs cleaning.</h2>
              <p className="mt-5 leading-7 text-slate-800">Send a few details and we’ll get back to you with a clear quote.</p>
              <div className="mt-10 space-y-5 text-sm font-bold">
                <a href="tel:+447500338585" className="flex items-center gap-3"><Phone className="size-5" /> 07500 338 585</a>
                <a href="mailto:am@primeviewlondon.co.uk" className="flex items-center gap-3"><Mail className="size-5" /> am@primeviewlondon.co.uk</a>
                <div className="flex items-center gap-3"><MapPin className="size-5" /> London West & North</div>
              </div>
            </div>
            <form className="grid gap-5 p-8 sm:grid-cols-2 sm:p-10 lg:p-12" action="mailto:am@primeviewlondon.co.uk" method="post" encType="text/plain">
              <label className="grid gap-2 text-sm font-bold">Name<input name="name" required className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="Your name" /></label>
              <label className="grid gap-2 text-sm font-bold">Phone<input name="phone" required className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="Your phone number" /></label>
              <label className="grid gap-2 text-sm font-bold sm:col-span-2">Postcode<input name="postcode" className="rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="Your postcode" /></label>
              <label className="grid gap-2 text-sm font-bold sm:col-span-2">What do you need cleaned?<textarea name="message" required rows={5} className="resize-none rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="Tell us about the property and service you need" /></label>
              <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0d234b] px-7 py-4 font-extrabold text-white transition hover:bg-blue-800 sm:col-span-2" type="submit">Request my free quote <ArrowRight className="size-5" /></button>
            </form>
          </div>
        </section>
      </main>

      <footer className="bg-[#071329] px-5 py-10 text-center text-sm text-blue-100">
        <p className="font-bold text-white">Prime View Window Care</p>
        <p className="mt-2">Serving London with clarity & care.</p>
        <p className="mt-5 text-xs text-blue-300">Website concept demo · Built by Proffera</p>
      </footer>

      <a href="https://wa.me/447500338585" aria-label="Chat on WhatsApp" className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-emerald-500 text-white shadow-2xl transition hover:scale-105">
        <MessageCircle className="size-7" />
      </a>
    </div>
  );
}
