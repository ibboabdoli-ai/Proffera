import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { primeViewSite } from "@/lib/primeview-seo";
import { isPrimeViewHost } from "@/lib/public-site-domains";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy | Proffera",
  description: "Privacy policy for Proffera, a product operated by Iboren.",
  robots: { index: true, follow: true },
};

const profferaSectionClass = "rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-200 shadow-2xl shadow-sky-950/20";
const primeViewSectionClass = "rounded-3xl border border-[#d9e4ef] bg-white p-6 shadow-[0_12px_36px_rgba(11,42,74,.06)] sm:p-8";

function ProfferaPrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="mb-10 space-y-4">
          <Link href="/" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
            ← Back to Proffera
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">Privacy</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="text-slate-300">Last updated: 16 August 2026</p>
          <p className="max-w-2xl text-lg text-slate-300">
            Proffera is a product operated by Iboren. This policy explains how we collect, use and protect personal data when you use Proffera.
          </p>
        </div>

        <div className="space-y-8">
          <section className={profferaSectionClass}>
            <h2 className="text-2xl font-semibold text-white">1. Controller</h2>
            <p className="mt-3 leading-7">
              Proffera drivs av Iboren. Iboren is responsible for personal data processed through Proffera unless another agreement states otherwise.
            </p>
            <p className="mt-3 leading-7">
              Contact: <a className="text-sky-300 hover:text-sky-200" href="mailto:ibbo.abdoli@gmail.com">ibbo.abdoli@gmail.com</a>
            </p>
          </section>

          <section className={profferaSectionClass}>
            <h2 className="text-2xl font-semibold text-white">2. Information we collect</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 leading-7">
              <li>Account and contact details, such as name, email address, phone number and company information.</li>
              <li>Billing details, subscription information, VAT information and payment status processed through Stripe.</li>
              <li>Booking, customer, quote, workspace and service data that users add to Proffera.</li>
              <li>Technical data such as browser, device, IP address, logs and security events.</li>
              <li>Support messages and other information you send to us.</li>
            </ul>
          </section>

          <section className={profferaSectionClass}>
            <h2 className="text-2xl font-semibold text-white">3. How we use information</h2>
            <p className="mt-3 leading-7">
              We use personal data to provide and operate Proffera, create accounts and workspaces, process subscriptions and tax information, send service messages, protect against abuse, improve the product and meet legal obligations.
            </p>
          </section>

          <section className={profferaSectionClass}>
            <h2 className="text-2xl font-semibold text-white">4. Legal bases</h2>
            <p className="mt-3 leading-7">
              We process personal data when it is necessary to provide the service, comply with legal obligations, protect legitimate interests, or when you have given consent.
            </p>
          </section>

          <section className={profferaSectionClass}>
            <h2 className="text-2xl font-semibold text-white">5. Service providers</h2>
            <p className="mt-3 leading-7">
              We use trusted service providers for hosting, payments, email, analytics, security and operations. Payment and subscription data may be processed by Stripe.
            </p>
          </section>

          <section className={profferaSectionClass}>
            <h2 className="text-2xl font-semibold text-white">6. Retention and security</h2>
            <p className="mt-3 leading-7">
              We keep personal data only for as long as needed to provide Proffera, meet legal requirements, resolve disputes and maintain security records. We use technical and organizational measures to protect personal data.
            </p>
          </section>

          <section className={profferaSectionClass}>
            <h2 className="text-2xl font-semibold text-white">7. Your rights</h2>
            <p className="mt-3 leading-7">
              Depending on applicable law, you may request access, correction, deletion, restriction or portability of your personal data. You may also object to certain processing.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function PrimeViewPrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f4f6fb] text-[#0b2a4a]">
      <header className="bg-[#06183b] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="flex items-center gap-3 font-black text-white">
            <Image
              src="/brand/primeview-window-care-logo.jpeg"
              alt="PrimeView Window Care"
              width={56}
              height={56}
              className="h-12 w-12 rounded-xl object-cover"
            />
            <span>PrimeView Window Care</span>
          </Link>
          <Link href="/booking" className="rounded-xl bg-[#1769c2] px-4 py-3 text-sm font-black text-white hover:bg-[#2f80ed]">
            Book online
          </Link>
        </div>
      </header>

      <section className="bg-[#06183b] px-5 pb-16 pt-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-black uppercase tracking-[.16em] text-[#b8ceff]">Privacy</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200">
            This notice explains how PrimeView Window Care uses personal information when you visit our website, request a quote, make or manage a booking, contact us or receive a service.
          </p>
          <p className="mt-3 text-sm text-slate-300">Last updated: 16 August 2026</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-5 px-5 py-10 sm:py-14">
        <section className={primeViewSectionClass}>
          <h2 className="text-2xl font-black">1. Who is responsible for your information?</h2>
          <p className="mt-4 leading-7 text-slate-600">
            PrimeView Window Care is the data controller for customer information collected through this website and in connection with our cleaning services.
          </p>
          <div className="mt-4 grid gap-1 text-sm font-semibold text-[#183e63]">
            <p>Email: <a className="underline" href={`mailto:${primeViewSite.email}`}>{primeViewSite.email}</a></p>
            <p>Phone: <a className="underline" href={`tel:${primeViewSite.telephone}`}>{primeViewSite.telephoneDisplay}</a></p>
          </div>
        </section>

        <section className={primeViewSectionClass}>
          <h2 className="text-2xl font-black">2. Information we collect</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-600">
            <li>Your name, email address and telephone number.</li>
            <li>Your service address and postcode.</li>
            <li>Booking details, preferred appointment times and the services you request.</li>
            <li>Property and access information you provide so we can price and plan the work safely.</li>
            <li>Messages, enquiries, reviews and other information you choose to send us.</li>
            <li>Limited technical and security information needed to operate and protect the website and booking service.</li>
          </ul>
        </section>

        <section className={primeViewSectionClass}>
          <h2 className="text-2xl font-black">3. How we use your information</h2>
          <p className="mt-4 leading-7 text-slate-600">
            We use information to provide quotes, bookings and services, communicate about appointments, run and protect the business, keep required records and respond to customer enquiries.
          </p>
        </section>

        <section className={primeViewSectionClass}>
          <h2 className="text-2xl font-black">4. Sharing, retention and security</h2>
          <p className="mt-4 leading-7 text-slate-600">
            We only share personal information with trusted providers where needed to operate the service, including booking, hosting, email or SMS delivery and essential business systems. We keep information only as long as reasonably necessary and use appropriate measures to protect it.
          </p>
        </section>

        <section className={primeViewSectionClass}>
          <h2 className="text-2xl font-black">5. Your rights</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Depending on the circumstances, you may have rights to access, correct, erase, restrict or object to processing of your personal information. Contact us using the details above to make a request.
          </p>
        </section>
      </div>
    </main>
  );
}

export default async function PrivacyPage() {
  const requestHeaders = await headers();
  if (isPrimeViewHost(requestHeaders.get("host"))) return <PrimeViewPrivacyPage />;
  return <ProfferaPrivacyPage />;
}
