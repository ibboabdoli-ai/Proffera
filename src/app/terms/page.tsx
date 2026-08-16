import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Proffera",
  description: "Terms of service for Proffera, a product operated by Iboren.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="mb-10 space-y-4">
          <Link href="/" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
            ← Back to Proffera
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">Terms</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="text-slate-300">Last updated: 16 August 2026</p>
          <p className="max-w-2xl text-lg text-slate-300">
            Proffera is a product operated by Iboren. These terms apply when you access or use Proffera.
          </p>
        </div>

        <div className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-200 shadow-2xl shadow-sky-950/20">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">1. Service provider</h2>
            <p>Proffera drivs av Iboren. Proffera is a business software product operated by Iboren.</p>
            <p>Contact: <a className="text-sky-300 hover:text-sky-200" href="mailto:ibbo.abdoli@gmail.com">ibbo.abdoli@gmail.com</a></p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">2. The service</h2>
            <p>Proffera provides online tools for service businesses, including booking, customer management, quotes, automation and related business workflows.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">3. Accounts and workspaces</h2>
            <p>You are responsible for keeping your account secure and for the activity that happens in your workspace. You must provide accurate billing and contact information.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">4. Subscriptions and payment</h2>
            <p>Paid subscriptions are billed through Stripe. Prices are shown at checkout. Unless stated otherwise, Swedish prices are shown including VAT/moms.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">5. Cancellation</h2>
            <p>You may cancel a subscription according to the cancellation options available in Proffera or Stripe Customer Portal. Access may continue until the end of the paid billing period.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">6. Acceptable use</h2>
            <p>You may not use Proffera for unlawful activity, abuse, spam, security attacks, or processing data that you do not have the right to process.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">7. Data and privacy</h2>
            <p>Our processing of personal data is described in the Privacy Policy.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">8. Changes</h2>
            <p>We may update these terms when the service or legal requirements change. The latest version will be published on this page.</p>
          </section>
        </div>
      </section>
    </main>
  );
}
