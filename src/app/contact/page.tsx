import Link from "next/link";

export const metadata = {
  title: "Contact | Proffera",
  description: "Contact Proffera for support, billing and product questions.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16 sm:px-8 lg:px-10">
        <div className="space-y-4">
          <Link href="/" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
            ← Back to Proffera
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">Contact</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Contact Proffera</h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Questions about Proffera, subscriptions, billing or support can be sent to our team.
          </p>
        </div>

        <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-200 shadow-2xl shadow-sky-950/20 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Support</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-400">Email</dt>
                <dd>
                  <a className="text-sky-300 hover:text-sky-200" href="mailto:ibbo.abdoli@gmail.com">
                    ibbo.abdoli@gmail.com
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Phone</dt>
                <dd>
                  <a className="text-sky-300 hover:text-sky-200" href="tel:+46790783238">
                    +46 79 078 32 38
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Website</dt>
                <dd>
                  <a className="text-sky-300 hover:text-sky-200" href="https://www.proffera.se/">
                    www.proffera.se
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">Company</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-400">Operating product</dt>
                <dd>Proffera</dd>
              </div>
              <div>
                <dt className="text-slate-400">Operator</dt>
                <dd>Iboren</dd>
              </div>
              <div>
                <dt className="text-slate-400">Address</dt>
                <dd>
                  Lundbygatan 26
                  <br />
                  151 46 Södertälje
                  <br />
                  Sweden
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="text-sm text-slate-400">
          Proffera drivs av Iboren. Proffera is a product operated by Iboren.
        </p>
      </section>
    </main>
  );
}
